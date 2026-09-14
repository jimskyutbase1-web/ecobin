import { useState, useEffect, useCallback, useRef } from 'react'

export function useEsp32(onLogReceived, defaultIp) {
  const envIp = import.meta.env.VITE_ESP32_IP || '192.168.1.150'
  const fallbackIp = defaultIp || envIp

  const [espIp, setEspIp] = useState(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname
      if (host && host !== 'localhost' && host !== '127.0.0.1') return host
      const saved = localStorage.getItem('ecobin_esp32_ip')
      if (saved) return saved
    }
    return fallbackIp
  })

  const [status, setStatus] = useState({
    connected: false,
    state: 'checking',
    ssid: '--',
    ip: '--',
    rssi: null,
    uptime: null,
    lastSync: null,
    error: null
  })

  const [isDemo, setIsDemo] = useState(false)
  const [autoPoll, setAutoPoll] = useState(true)
  const [wifiStreamEnabled, setWifiStreamEnabled] = useState(true)

  const demoUptimeRef = useRef(150)
  const lastLogIndexRef = useRef(0)

  const updateEspIp = (newIp) => {
    setEspIp(newIp)
    localStorage.setItem('ecobin_esp32_ip', newIp)
  }

  const fetchStatus = useCallback(async () => {
    if (isDemo) {
      demoUptimeRef.current += 3
      setStatus({
        connected: true,
        state: 'connected',
        ssid: 'EcoBin_5G_IoT',
        ip: espIp || '192.168.1.150',
        rssi: -58,
        uptime: demoUptimeRef.current,
        lastSync: new Date().toLocaleTimeString(),
        error: null
      })
      return
    }

    setStatus(prev => ({ ...prev, state: 'checking' }))

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2500)

    try {
      const res = await fetch(`http://${espIp}/api/status`, {
        signal: controller.signal,
        mode: 'cors'
      })
      clearTimeout(timeout)

      if (!res.ok) throw new Error(`HTTP Error ${res.status}`)
      const data = await res.json()

      const isConn = data.connected === true || data.status === 'connected'
      setStatus({
        connected: isConn,
        state: isConn ? 'connected' : 'disconnected',
        ssid: data.ssid || '--',
        ip: data.ip || espIp,
        rssi: data.rssi || -60,
        uptime: data.uptime || 0,
        lastSync: new Date().toLocaleTimeString(),
        error: isConn ? null : 'Wi-Fi disconnected on device'
      })
    } catch (err) {
      clearTimeout(timeout)
      setStatus(prev => ({
        ...prev,
        connected: false,
        state: 'disconnected',
        lastSync: new Date().toLocaleTimeString(),
        error: `Cannot reach ESP32 at http://${espIp}`
      }))
    }
  }, [espIp, isDemo])

  const fetchLogs = useCallback(async () => {
    if (isDemo || !wifiStreamEnabled || !espIp) return

    try {
      const res = await fetch(`http://${espIp}/api/logs`, { mode: 'cors' })
      if (!res.ok) return
      const data = await res.json()

      if (data.logs && Array.isArray(data.logs)) {
        if (data.logs.length > lastLogIndexRef.current) {
          const newLogs = data.logs.slice(lastLogIndexRef.current)
          newLogs.forEach(line => onLogReceived && onLogReceived(line))
          lastLogIndexRef.current = data.logs.length
        }
      }
    } catch (err) {}
  }, [espIp, isDemo, wifiStreamEnabled, onLogReceived])

  const sendWifiCommand = useCallback(async (cmd) => {
    if (isDemo) {
      return handleDemoCommand(cmd)
    }

    try {
      const res = await fetch(`http://${espIp}/api/command?cmd=${encodeURIComponent(cmd)}`, {
        mode: 'cors'
      })
      const data = await res.json()
      return data.response || `Command "${cmd}" received.`
    } catch (err) {
      throw new Error(`Failed to send command: ${err.message}`)
    }
  }, [espIp, isDemo])

  const handleDemoCommand = (cmd) => {
    const c = cmd.toLowerCase().trim()
    if (c === 'help') {
      return 'Available Commands: status, ping, scan, led on, led off, heap, reboot'
    } else if (c === 'status') {
      return `[STATUS] Wi-Fi: Connected | SSID: EcoBin_5G_IoT | IP: ${espIp} | RSSI: -58 dBm | Uptime: ${demoUptimeRef.current}s`
    } else if (c === 'ping') {
      return `[PONG] ESP32 is online. (millis: ${Date.now()})`
    } else if (c === 'scan') {
      return '[WIFI] Found 3 networks:\n  [1] EcoBin_5G_IoT (-58 dBm)\n  [2] Office_WiFi_Guest (-74 dBm)\n  [3] IoT_M2M (-82 dBm)'
    } else if (c === 'led on' || c === 'led off') {
      return `[HARDWARE] Onboard LED turned ${c.toUpperCase()}`
    } else if (c === 'heap') {
      return '[INFO] Free Heap: 284920 bytes'
    } else if (c === 'reboot') {
      return '[SYSTEM] Rebooting ESP32 in 1 second...'
    }
    return `[ERROR] Unknown command: '${cmd}'. Type 'help' for command list.`
  }

  useEffect(() => {
    fetchStatus()
    let statusTimer = null
    if (autoPoll) {
      statusTimer = setInterval(fetchStatus, 3000)
    }
    return () => clearInterval(statusTimer)
  }, [fetchStatus, autoPoll])

  useEffect(() => {
    let logTimer = null
    if (wifiStreamEnabled && !isDemo) {
      logTimer = setInterval(fetchLogs, 2000)
    }
    return () => clearInterval(logTimer)
  }, [fetchLogs, wifiStreamEnabled, isDemo])

  const toggleDemo = () => {
    setIsDemo(prev => !prev)
    lastLogIndexRef.current = 0
  }

  return {
    espIp,
    updateEspIp,
    status,
    isDemo,
    toggleDemo,
    autoPoll,
    setAutoPoll,
    wifiStreamEnabled,
    setWifiStreamEnabled,
    fetchStatus,
    sendWifiCommand
  }
}
