import { initializeApp } from 'firebase/app'
import { getAnalytics, isSupported } from 'firebase/analytics'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyA2bUo15pxy8cwIngrUNJ1mqv1NX6Q9i_Y",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ecobin-39c3c.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://ecobin-39c3c-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "ecobin-39c3c",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "ecobin-39c3c.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "402291278738",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:402291278738:web:a4c07203c508404043374b",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-QYNYNWDW3B"
}

export const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)

export let analytics = null
if (typeof window !== 'undefined') {
  isSupported().then(yes => {
    if (yes) {
      analytics = getAnalytics(app)
    }
  }).catch(() => {})
}
