import React from 'react'
import { Wifi, Cpu, Signal, Clock } from 'lucide-react'

function formatUptime(seconds) {
  if (seconds === null || seconds === undefined) return '--'
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hrs > 0) return `${hrs}h ${mins}m`
  if (mins > 0) return `${mins}m ${secs}s`
  return `${secs}s`
}

function getSignalQuality(rssi) {
  if (!rssi && rssi !== 0) return { text: 'No Signal', color: 'text-slate-500' }
  if (rssi >= -55) return { text: 'Excellent', color: 'text-emerald-600' }
  if (rssi >= -70) return { text: 'Good', color: 'text-blue-600' }
  if (rssi >= -82) return { text: 'Fair', color: 'text-amber-600' }
  return { text: 'Weak', color: 'text-rose-600' }
}

export default function TelemetryGrid({ status }) {
  const signalInfo = getSignalQuality(status.rssi)

  const metrics = [
    {
      title: 'Wi-Fi SSID',
      icon: Wifi,
      value: status.ssid || '--',
      sub: status.connected ? 'Connected' : 'Disconnected',
      subColor: status.connected ? 'text-emerald-600' : 'text-slate-500'
    },
    {
      title: 'Device IP',
      icon: Cpu,
      value: status.ip || '--',
      sub: status.connected ? 'Active' : 'Unreachable',
      subColor: status.connected ? 'text-blue-600' : 'text-slate-500'
    },
    {
      title: 'Signal (RSSI)',
      icon: Signal,
      value: status.rssi ? `${status.rssi} dBm` : '--',
      sub: signalInfo.text,
      subColor: signalInfo.color
    },
    {
      title: 'Uptime',
      icon: Clock,
      value: formatUptime(status.uptime),
      sub: status.connected ? 'Running' : 'Offline',
      subColor: status.connected ? 'text-emerald-600' : 'text-slate-500'
    }
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {metrics.map((metric, idx) => {
        const IconComponent = metric.icon
        return (
          <div
            key={idx}
            className="p-3.5 rounded-xl bg-white border border-slate-200 flex flex-col justify-between"
          >
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              <IconComponent className="w-3.5 h-3.5 text-slate-400" />
              <span>{metric.title}</span>
            </div>
            <div className="font-mono text-lg font-bold text-slate-900 break-all my-0.5">
              {metric.value}
            </div>
            <div className={`text-xs font-medium ${metric.subColor}`}>
              {metric.sub}
            </div>
          </div>
        )
      })}
    </div>
  )
}
