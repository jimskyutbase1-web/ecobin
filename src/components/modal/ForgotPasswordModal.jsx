import React, { useState, useEffect } from 'react'
import { X, KeyRound, CheckCircle2, Phone, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { db } from '../../firebase'
import { collection, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { sendSms } from '../../services/pushbullet'

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default function ForgotPasswordModal({ isOpen = false, onClose }) {
  const [contact, setContact] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [sentCode, setSentCode] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [codeSuccess, setCodeSuccess] = useState('')
  const [sendingCode, setSendingCode] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [matchedUserId, setMatchedUserId] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordResetSuccess, setPasswordResetSuccess] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setContact('')
      setCodeSent(false)
      setSentCode('')
      setVerificationCode('')
      setCodeError('')
      setCodeSuccess('')
      setSendingCode(false)
      setIsVerified(false)
      setMatchedUserId('')
      setNewPassword('')
      setConfirmPassword('')
      setShowNewPassword(false)
      setShowConfirmPassword(false)
      setPasswordError('')
      setPasswordResetSuccess(false)
      setSavingPassword(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  function handleContactFocus() {
    if (!contact) {
      setContact('+63')
    }
  }

  function handleContactChange(e) {
    let val = e.target.value
    if (!val) {
      setContact('')
      return
    }
    if (!val.startsWith('+63')) {
      const digits = val.replace(/\D/g, '')
      if (digits.startsWith('63')) {
        val = '+' + digits
      } else {
        val = '+63' + digits
      }
    } else {
      const rest = val.slice(3).replace(/\D/g, '')
      val = '+63' + rest
    }
    if (val.length > 13) {
      val = val.slice(0, 13)
    }
    setContact(val)
    if (codeSent) {
      setCodeSent(false)
      setSentCode('')
      setVerificationCode('')
      setCodeError('')
      setCodeSuccess('')
    }
  }

  const isContactValid = contact.startsWith('+63') && contact.length === 13 && /^\+63\d{10}$/.test(contact)

  function getContactProblem() {
    if (!contact) return ''
    if (!contact.startsWith('+63')) {
      return 'Number must start with +63'
    }
    if (contact.length < 13) {
      return `Number is too short (${contact.length}/13 characters). Requires 10 digits after +63.`
    }
    if (!/^\+63\d{10}$/.test(contact)) {
      return 'Only digits are allowed after +63'
    }
    return ''
  }

  async function handleSendCode() {
    if (!isContactValid) return
    setSendingCode(true)
    setCodeError('')
    try {
      const snap = await getDocs(collection(db, 'users'))
      const enteredDigits = contact.replace(/\D/g, '')
      const found = snap.docs.find((d) => {
        const data = d.data()
        const c = (data.contact || '').trim()
        return c === contact || (c.replace(/\D/g, '') && c.replace(/\D/g, '') === enteredDigits)
      })
      if (!found) {
        setCodeError('No account found with this contact number.')
        setSendingCode(false)
        return
      }
      setMatchedUserId(found.id)
    } catch {}

    const generated = Math.floor(100000 + Math.random() * 900000).toString()
    setSentCode(generated)
    setCodeSent(true)
    setCodeSuccess('Verification code has been sent to your contact number.')
    try {
      await sendSms(contact, `Your EcoBin verification code is: ${generated}`)
    } catch {}
    setSendingCode(false)
  }

  function handleVerifyCode() {
    setCodeError('')
    if (!verificationCode || verificationCode.length !== 6) {
      setCodeError('Please enter the complete 6-digit verification code.')
      return
    }
    if (verificationCode !== sentCode) {
      setCodeError('Invalid code. Please check the code sent to your number.')
      return
    }
    setIsVerified(true)
  }

  async function handleResetPassword(e) {
    e.preventDefault()
    setPasswordError('')
    if (!newPassword) {
      setPasswordError('Please enter a new password.')
      return
    }
    if (newPassword.length < 4) {
      setPasswordError('Password must be at least 4 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }
    setSavingPassword(true)
    try {
      const hashedPassword = await sha256(newPassword)
      let docId = matchedUserId
      if (!docId) {
        const snap = await getDocs(collection(db, 'users'))
        const enteredDigits = contact.replace(/\D/g, '')
        const found = snap.docs.find((d) => {
          const data = d.data()
          const c = (data.contact || '').trim()
          return c === contact || (c.replace(/\D/g, '') && c.replace(/\D/g, '') === enteredDigits)
        })
        if (found) docId = found.id
      }
      if (docId) {
        await updateDoc(doc(db, 'users', docId), {
          password: hashedPassword,
          updatedAt: serverTimestamp()
        })
        setSavingPassword(false)
        setPasswordResetSuccess(true)
      } else {
        setPasswordError('User account not found for this contact number.')
        setSavingPassword(false)
      }
    } catch (err) {
      setPasswordError('Failed to update password: ' + (err.message || 'Please check your connection.'))
      setSavingPassword(false)
    }
  }

  const handleClose = () => {
    if (onClose) onClose()
  }

  if (isVerified) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 sm:p-7 relative">
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex gap-3.5 items-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-7 h-7" />
            </div>

            <div className="flex flex-col">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Set New Password
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Enter your new password and confirm it below.
              </p>
            </div>
          </div>

          {passwordResetSuccess ? (
            <div className="mt-5 p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2.5" />
              <p className="text-sm font-bold text-emerald-900">
                Password Reset Successfully!
              </p>
              <p className="text-xs text-emerald-700 mt-1">
                Your password has been updated. You can now sign in with your new credentials.
              </p>
              <button
                type="button"
                onClick={handleClose}
                className="mt-4 w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="mt-5 space-y-4">
              {passwordError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {passwordError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Enter New Password
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full pl-9 pr-10 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 bg-slate-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full pl-9 pr-10 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 bg-slate-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200 transition cursor-pointer disabled:opacity-60"
                >
                  {savingPassword ? 'Updating...' : 'Reset Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 sm:p-7 relative">
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex gap-3.5 items-center">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
            <KeyRound className="w-7 h-7" />
          </div>

          <div className="flex flex-col">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Reset Password
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Enter your registered contact number to receive a verification code.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Contact Number
            </label>
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <Phone className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={contact}
                  onFocus={handleContactFocus}
                  onClick={handleContactFocus}
                  onChange={handleContactChange}
                  maxLength={13}
                  placeholder="+639123456789"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 bg-slate-50 font-mono"
                />
              </div>
              {isContactValid && (
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={sendingCode}
                  className="px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200 transition shrink-0 cursor-pointer"
                >
                  {sendingCode ? 'Sending...' : (codeSent ? 'Resend Code' : 'Send Code')}
                </button>
              )}
            </div>
            {getContactProblem() && (
              <p className="text-[11px] text-rose-500 mt-1 font-medium">
                {getContactProblem()}
              </p>
            )}
          </div>

          {codeSent && (
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Enter 6-Digit Code
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit code"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm tracking-widest text-center font-mono font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 bg-slate-50"
                />
                <button
                  type="button"
                  onClick={handleVerifyCode}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200 transition shrink-0 cursor-pointer"
                >
                  Verify Code
                </button>
              </div>
              {codeError && (
                <p className="text-[11px] text-rose-500 mt-1 font-medium">
                  {codeError}
                </p>
              )}
              {codeSuccess && (
                <p className="text-[11px] text-emerald-600 mt-1 font-medium">
                  {codeSuccess}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-end pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
