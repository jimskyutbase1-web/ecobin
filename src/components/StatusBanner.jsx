import React from 'react'
import { Wifi, Radio, AlertTriangle } from 'lucide-react'

export default function StatusBanner({ status, espIp }) {
  const { state, ssid, error } = status

  let containerStyles = 'bg-slate-50 border-slate-200'
  let iconStyles = 'bg-slate-200 text-slate-700'
  let pillStyles = 'bg-slate-200 text-slate-700'
  let Icon = Radio
  let headline = 'Connecting to ESP32...'
  let description = `Awaiting response from http://${espIp}/api/status`
  let pillText = 'INITIALIZING'

  if (state === 'connected') {
    containerStyles = 'bg-emerald-50 border-emerald-200'
    iconStyles = 'bg-emerald-100 text-emerald-700'
    pillStyles = 'bg-emerald-100 text-emerald-800 font-semibold'
    Icon = Wifi
    headline = 'ESP32 Wi-Fi Connected'
    description = `Connected to network "${ssid || 'Local Wi-Fi'}"`
    pillText = 'ONLINE'
  } else if (state === 'checking') {
    containerStyles = 'bg-amber-50 border-amber-200'
    iconStyles = 'bg-amber-100 text-amber-700'
    pillStyles = 'bg-amber-100 text-amber-800 font-semibold'
    Icon = Radio
    headline = 'Checking Connection...'
    description = `Connecting to http://${espIp}/api/status`
    pillText = 'CHECKING'
  } else if (state === 'disconnected') {
    containerStyles = 'bg-rose-50 border-rose-200'
    iconStyles = 'bg-rose-100 text-rose-700'
    pillStyles = 'bg-rose-100 text-rose-800 font-semibold'
    Icon = AlertTriangle
    headline = 'ESP32 Disconnected'
    description = error || `Unable to reach http://${espIp}`
    pillText = 'OFFLINE'
  }

  return (
    <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border mb-5 ${containerStyles}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconStyles}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900 leading-tight">
            {headline}
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            {description}
          </p>
        </div>
      </div>

      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${pillStyles}`}>
        <span className="w-2 h-2 rounded-full bg-current" />
        <span>{pillText}</span>
      </div>
    </div>
  )
}
