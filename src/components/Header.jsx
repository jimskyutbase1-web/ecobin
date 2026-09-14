import React from 'react'

export default function Header() {
  return (
    <header className="pb-2 border-b border-slate-200">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
        ESP32 Wi-Fi & Serial Monitor
      </h1>
      <p className="text-sm text-slate-500 mt-1">
        Hardware connection status, live telemetry, and serial command interface.
      </p>
    </header>
  )
}
