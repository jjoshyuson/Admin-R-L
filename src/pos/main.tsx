import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PosApp } from './PosApp'
import { registerServiceWorker } from '../registerServiceWorker'
import './pos.css'

function disableMobileBrowserZoom() {
  let lastTouchEnd = 0

  document.addEventListener('touchend', (event) => {
    const now = Date.now()
    if (now - lastTouchEnd <= 300) {
      event.preventDefault()
    }
    lastTouchEnd = now
  }, { passive: false })

  document.addEventListener('touchmove', (event) => {
    if (event.touches.length > 1) {
      event.preventDefault()
    }
  }, { passive: false })

  document.addEventListener('gesturestart', (event) => {
    event.preventDefault()
  })
}

registerServiceWorker()
disableMobileBrowserZoom()

createRoot(document.getElementById('pos-root')!).render(
  <StrictMode>
    <PosApp />
  </StrictMode>,
)
