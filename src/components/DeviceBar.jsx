import React, { useState } from 'react'
import { RotateCw, Play, CheckCircle2, Globe } from 'lucide-react'

export default function DeviceBar({ espIp, onUpdateIp, onSync, isDemo, onToggleDemo, isChecking }) {
  const [localIp, setLocalIp] = useState(espIp)

  const handleBlurOrSubmit = (e) => {
    e?.preventDefault?.()
    if (localIp.trim()) {
      onUpdateIp(localIp.trim())
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 mb-5">
      <form onSubmit={handleBlurOrSubmit} className="flex items-center gap-3 flex-1 min-w-[240px]">
        <label htmlFor="espIpInput" className="text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap flex items-center gap-1.5">
          <Globe className="w-4 h-4 text-slate-500" />
          ESP32 IP / Host
        </label>
        <input
          id="espIpInput"
          type="text"
          value={localIp}
          onChange={(e) => setLocalIp(e.target.value)}
          onBlur={handleBlurOrSubmit}
          placeholder="192.168.1.150"
          spellCheck={false}
          className="flex-1 bg-white border border-slate-300 text-slate-900 font-mono text-sm px-3 py-1.5 rounded-lg outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition"
        />
      </form>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            handleBlurOrSubmit()
            onSync()
          }}
          className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-3.5 py-2 rounded-lg transition"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
          <span>Sync Wi-Fi</span>
        </button>

        <button
          type="button"
          onClick={onToggleDemo}
          className={`inline-flex items-center justify-center gap-1.5 font-medium text-xs px-3.5 py-2 rounded-lg border transition ${
            isDemo
              ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
          }`}
        >
          {isDemo ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Simulating</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 text-slate-500" />
              <span>Simulate</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
