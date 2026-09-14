import React, { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, onSnapshot } from 'firebase/firestore'
import Dashboard from './components/page/dashboard'
import Login from './components/page/login'
import Esp32OfflineModal from './components/modal/Esp32OfflineModal'

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const deviceIp = import.meta.env.VITE_ESP32_IP || '192.168.43.221'

  useEffect(() => {
    let active = true
    let lastSnapshotOnline = false

    const checkDirectConnection = async () => {
      if (!deviceIp || deviceIp === '0.0.0.0') {
        if (active) setIsOffline(true)
        return
      }
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 1500)
        const res = await fetch(`http://${deviceIp}/api/status`, {
          signal: controller.signal,
          mode: 'cors'
        })
        clearTimeout(timeout)
        if (active) {
          if (res.ok) {
            const data = await res.json().catch(() => null)
            const isConn = data ? (data.connected === true || data.status === 'connected') : true
            setIsOffline(!isConn)
          } else if (!lastSnapshotOnline) {
            setIsOffline(true)
          }
        }
      } catch (err) {
        if (active && !lastSnapshotOnline) {
          setIsOffline(true)
        }
      }
    }

    checkDirectConnection()
    const timer = setInterval(checkDirectConnection, 4000)

    const unsubscribe = onSnapshot(collection(db, 'trash_records'), (snapshot) => {
      if (!active) return
      if (snapshot.empty) {
        lastSnapshotOnline = false
        checkDirectConnection()
        return
      }
      let newestTime = 0
      snapshot.docs.forEach((doc) => {
        const data = doc.data()
        if (deviceIp && data.deviceIp && data.deviceIp !== deviceIp) return
        let t = 0
        if (data.timestamp && typeof data.timestamp.toDate === 'function') {
          t = data.timestamp.toDate().getTime()
        } else if (data.timestamp && typeof data.timestamp === 'number') {
          t = new Date(data.timestamp).getTime()
        } else if (data.recorded_at) {
          t = new Date(data.recorded_at).getTime()
        } else if (doc._document?.createTime?.timestamp?.toDate) {
          t = doc._document.createTime.timestamp.toDate().getTime()
        } else if (doc._document?.createTime?.toMillis) {
          t = doc._document.createTime.toMillis()
        }
        if (t > newestTime) newestTime = t
      })

      const isRecent = newestTime > 0 && (Date.now() - newestTime < 15000)
      lastSnapshotOnline = isRecent
      if (isRecent) {
        setIsOffline(false)
        setDismissed(false)
      } else {
        checkDirectConnection()
      }
    }, () => {
      lastSnapshotOnline = false
      if (active) checkDirectConnection()
    })

    return () => {
      active = false
      clearInterval(timer)
      unsubscribe()
    }
  }, [deviceIp])

  const handleClose = () => {
    setDismissed(true)
  }

  const handleRetry = () => {
    setDismissed(false)
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
  }

  const handleLogin = () => {
    setIsAuthenticated(true)
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <>
      <Dashboard
        isOffline={isOffline}
        isOnline={!isOffline}
        onLogout={handleLogout}
      />
      <Esp32OfflineModal
        isOpen={isOffline && !dismissed}
        onClose={handleClose}
        onRetry={handleRetry}
        deviceIp={deviceIp}
      />
    </>
  )
}
