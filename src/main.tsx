import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './style.css'

const shouldEnableServiceWorker = import.meta.env.PROD && import.meta.env.VITE_ENABLE_SW === 'true'
const isLocalhost =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '[::1]'

const canRegisterServiceWorker =
  'serviceWorker' in navigator &&
  (window.location.protocol === 'https:' || isLocalhost)

if (canRegisterServiceWorker && shouldEnableServiceWorker) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((error) => {
        if (import.meta.env.DEV) {
          console.warn('Service worker registration failed.', error)
        }
      })
  })
} else if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        void registration.unregister()
      })
    })
    if ('caches' in window) {
      void caches.keys().then((keys) => {
        keys
          .filter((key) => key.startsWith('ooh-admin-'))
          .forEach((key) => {
            void caches.delete(key)
          })
      })
    }
  })
}

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
