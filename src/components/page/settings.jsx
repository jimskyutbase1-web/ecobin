import React, { useState, useEffect } from 'react'
import {
  Settings as SettingsIcon,
  User,
  Shield,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound
} from 'lucide-react'
import Sidebar from './sidebar'
import { db } from '../../firebase'
import { collection, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore'

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default function Settings({
  isOffline: propIsOffline,
  isOnline: propIsOnline,
  onTabChange,
  deviceIp: propDeviceIp,
  onLogout
}) {
  const [activeTab, setActiveTab] = useState('settings')
  const [currentUser, setCurrentUser] = useState(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const effectiveDeviceIp = propDeviceIp || import.meta.env.VITE_ESP32_IP || '192.168.43.221'

  useEffect(() => {
    let active = true

    async function loadUserData() {
      setLoadingUser(true)
      let storedUser = null
      try {
        const saved = localStorage.getItem('ecobin_auth_user')
        if (saved) storedUser = JSON.parse(saved)
      } catch {}

      try {
        const snap = await getDocs(collection(db, 'users'))
        if (!active) return

        let matched = null
        if (storedUser?.id) {
          matched = snap.docs.find((d) => d.id === storedUser.id)
        }
        if (!matched && storedUser?.contact) {
          matched = snap.docs.find((d) => (d.data().contact || '').trim() === storedUser.contact.trim())
        }
        if (!matched) {
          matched = snap.docs.find((d) => (d.data().role || '').toLowerCase() === 'admin')
        }
        if (!matched && !snap.empty) {
          matched = snap.docs[0]
        }

        if (matched) {
          const data = matched.data()
          setCurrentUser({
            id: matched.id,
            name: data.name || matched.id,
            contact: data.contact || '',
            role: data.role || 'admin',
            storedPassword: data.password || ''
          })
        } else if (storedUser) {
          setCurrentUser(storedUser)
        }
      } catch {
        if (storedUser) setCurrentUser(storedUser)
      } finally {
        if (active) setLoadingUser(false)
      }
    }

    loadUserData()
    return () => {
      active = false
    }
  }, [])

  function handleTabNavigation(id) {
    setActiveTab(id)
    if (onTabChange) {
      onTabChange(id)
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!currentPassword) {
      setError('Please enter your current password.')
      return
    }

    if (!newPassword) {
      setError('Please enter your new password.')
      return
    }

    if (newPassword.length < 4) {
      setError('New password must be at least 4 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.')
      return
    }

    if (currentPassword === newPassword) {
      setError('New password cannot be the same as current password.')
      return
    }

    setSubmitting(true)

    try {
      let targetDocId = currentUser?.id
      let currentStoredHash = currentUser?.storedPassword

      const snap = await getDocs(collection(db, 'users'))
      let foundDoc = null

      if (targetDocId) {
        foundDoc = snap.docs.find((d) => d.id === targetDocId)
      }
      if (!foundDoc && currentUser?.contact) {
        foundDoc = snap.docs.find((d) => (d.data().contact || '').trim() === currentUser.contact.trim())
      }
      if (!foundDoc) {
        foundDoc = snap.docs.find((d) => (d.data().role || '').toLowerCase() === 'admin')
      }

      if (foundDoc) {
        targetDocId = foundDoc.id
        currentStoredHash = foundDoc.data().password || ''
      }

      if (!targetDocId) {
        setError('User document could not be located in Firestore.')
        setSubmitting(false)
        return
      }

      const currentHashed = await sha256(currentPassword)
      if (currentStoredHash && currentStoredHash !== currentHashed) {
        setError('Current password is incorrect.')
        setSubmitting(false)
        return
      }

      const newHashed = await sha256(newPassword)
      await updateDoc(doc(db, 'users', targetDocId), {
        password: newHashed,
        updatedAt: serverTimestamp()
      })

      setCurrentUser((prev) => ({
        ...(prev || {}),
        storedPassword: newHashed
      }))

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess('Your password has been successfully updated.')
    } catch (err) {
      setError('Failed to update password: ' + (err.message || 'Please check your connection.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex">
      <Sidebar
        activeTab={activeTab}
        onTabChange={handleTabNavigation}
        deviceIp={effectiveDeviceIp}
        isOnline={propIsOnline !== undefined ? propIsOnline : !propIsOffline}
        onLogout={onLogout}
      />

      <div className="flex-1 min-w-0 py-8 px-4 sm:px-8 overflow-y-auto">
        <main className="w-full max-w-4xl mx-auto flex flex-col gap-6">
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-100">
                  <SettingsIcon className="w-5 h-5" />
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                  Settings
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Manage your administrator account credentials and security preferences
              </p>
            </div>
          </header>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-7">
            <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Account Details
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Your registered administrator profile information
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Username
                  </label>
                  <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    Read-only
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    readOnly
                    value={loadingUser ? 'Loading...' : (currentUser?.name || currentUser?.id || 'Administrator')}
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-semibold cursor-not-allowed select-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Role
                  </label>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Shield className="w-4 h-4 text-emerald-600" />
                  </span>
                  <input
                    type="text"
                    readOnly
                    value={loadingUser ? 'Loading...' : (currentUser?.role ? currentUser.role.toUpperCase() : 'ADMIN')}
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-semibold cursor-not-allowed select-none"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-7">
            <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Change Password
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update your credentials stored in the Firestore database
                </p>
              </div>
            </div>

            {error && (
              <div className="mt-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-800 text-xs font-medium">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="mt-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-emerald-800 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Current Password
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value)
                      if (error) setError('')
                    }}
                    placeholder="Enter your current password"
                    className="w-full pl-10 pr-11 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value)
                        if (error) setError('')
                      }}
                      placeholder="Enter new password"
                      className="w-full pl-10 pr-11 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value)
                        if (error) setError('')
                      }}
                      placeholder="Confirm new password"
                      className="w-full pl-10 pr-11 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200 transition cursor-pointer disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
                  )}
                </button>
              </div>
            </form>
          </section>
        </main>
      </div>
    </div>
  )
}
