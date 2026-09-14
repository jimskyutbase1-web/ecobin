let cachedDeviceKey = import.meta.env.VITE_PUSHBULLET_DEVICE_IDEN || null

export function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber) return ''
  let clean = String(phoneNumber).replace(/[^0-9]/g, '')
  if (clean.startsWith('09')) {
    return '+63' + clean.slice(1)
  } else if (clean.startsWith('639')) {
    return '+' + clean
  } else if (clean.startsWith('+')) {
    return clean
  }
  return '+' + clean
}

export async function getDeviceKey(token) {
  if (cachedDeviceKey) return cachedDeviceKey
  const accessToken = token || import.meta.env.VITE_PUSHBULLET_ACCESS_TOKEN || ''
  if (!accessToken) return null

  try {
    const res = await fetch('https://api.pushbullet.com/v2/devices', {
      headers: {
        'Access-Token': accessToken
      }
    })
    if (!res.ok) return null
    const data = await res.json()
    const devices = data.devices || []
    let deviceKey = null
    for (const device of devices) {
      if (device.has_sms && device.iden) {
        deviceKey = device.iden
        break
      }
    }
    if (!deviceKey && devices.length > 0) {
      deviceKey = devices[0]?.iden || null
    }
    if (deviceKey) {
      cachedDeviceKey = deviceKey
    }
    return deviceKey
  } catch (err) {
    console.error(err)
    return null
  }
}

export async function sendSms(phoneNumber, message, token) {
  const accessToken = token || import.meta.env.VITE_PUSHBULLET_ACCESS_TOKEN || ''
  if (!accessToken) {
    console.warn('Pushbullet access token not configured in .env')
    return false
  }

  if (!phoneNumber) {
    console.warn('Pushbullet SMS: Empty phone number provided.')
    return false
  }

  const cleanNumber = formatPhoneNumber(phoneNumber)

  try {
    const deviceKey = await getDeviceKey(accessToken)
    if (!deviceKey) {
      console.error('Pushbullet: No SMS-capable Android device found.')
      return false
    }

    const res = await fetch('https://api.pushbullet.com/v2/texts', {
      method: 'POST',
      headers: {
        'Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: {
          addresses: [cleanNumber],
          message: message,
          target_device_iden: deviceKey
        }
      })
    })

    if (res.ok) {
      return true
    } else {
      const body = await res.text()
      console.error('Pushbullet SMS failed: ' + body)
      return false
    }
  } catch (e) {
    console.error('Pushbullet SMS exception: ' + e.message)
    return false
  }
}

export async function sendPushbulletNotification({ title, body, email, token }) {
  const accessToken = token || import.meta.env.VITE_PUSHBULLET_ACCESS_TOKEN || ''
  if (!accessToken) return { success: false, reason: 'missing_token' }
  const payload = { type: 'note', title, body }
  if (email) payload.email = email
  try {
    const response = await fetch('https://api.pushbullet.com/v2/pushes', {
      method: 'POST',
      headers: {
        'Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    const data = await response.json().catch(() => null)
    return { success: response.ok, data }
  } catch (error) {
    return { success: false, error }
  }
}

export async function notifyRecipientsViaPushbullet({ binName, fillPercentage, distanceCm, status }, recipients = []) {
  const token = import.meta.env.VITE_PUSHBULLET_ACCESS_TOKEN || ''

  if (!recipients || recipients.length === 0) {
    return []
  }

  const seenNumbers = new Set()
  const uniqueRecipients = []
  for (const recipient of recipients) {
    const phone = recipient.contact || recipient.contactNumber || recipient.phone
    if (!phone) continue
    const cleanNumber = formatPhoneNumber(phone)
    if (!seenNumbers.has(cleanNumber)) {
      seenNumbers.add(cleanNumber)
      uniqueRecipients.push({ ...recipient, cleanPhone: cleanNumber })
    }
  }

  const dispatches = uniqueRecipients.map(async (recipient) => {
    const phone = recipient.cleanPhone || recipient.contact || recipient.contactNumber || recipient.phone
    const message = `EcoBin Alert: ${binName} waste compartment is at ${fillPercentage}% capacity (${distanceCm} cm clearance). Status: ${status}.`
    return sendSms(phone, message, recipient.pushbulletToken || token)
  })

  return await Promise.all(dispatches)
}
