import React, { useState } from 'react'
import { db } from '../../firebase'
import { doc, deleteDoc } from 'firebase/firestore'
import { Trash2, X, AlertTriangle, Loader2 } from 'lucide-react'

export default function DeleteRecipientModal({
  isOpen = false,
  recipient,
  onClose,
  onDeleted
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen || !recipient) {
    return null
  }

  async function handleDelete() {
    setDeleting(true)
    setError('')

    const docId = recipient.id || recipient.name

    try {
      if (docId) {
        await deleteDoc(doc(db, 'recipients', docId))
      }
    } catch (err) {
      console.error(err)
    }

    try {
      const existing = localStorage.getItem('ecobin_recipients')
      if (existing) {
        const list = JSON.parse(existing)
        const updated = list.filter((r) => r.id !== docId && r.name !== recipient.name)
        localStorage.setItem('ecobin_recipients', JSON.stringify(updated))
      }
    } catch (err) {
      console.error(err)
    }

    if (onDeleted) {
      onDeleted(recipient)
    }

    setDeleting(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
          <Trash2 className="w-6 h-6" />
        </div>

        <h3 className="text-base font-bold text-slate-900">
          Delete Recipient
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Are you sure you want to remove <span className="font-semibold text-slate-800">{recipient.name}</span> from alert notifications?
        </p>

        {recipient.contact && (
          <div className="mt-3 py-1.5 px-3 bg-slate-50 rounded-lg border border-slate-200 inline-block mx-auto text-xs font-mono text-slate-600">
            {recipient.contact}
          </div>
        )}

        {error && (
          <div className="mt-3 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            {deleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>
        </div>
      </div>
    </div>
  )
}
