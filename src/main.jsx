import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AppProvider } from './context/AppContext'
import { ensureSettings, seedDatabase } from './db/db'
import './index.css'
import './styles/glass.css'

async function boot() {
  try {
    await seedDatabase()
    await ensureSettings()
  } catch (error) {
    console.error('MatatuPulse local database could not be initialised:', error)
  }

  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <AppProvider>
        <App />
      </AppProvider>
    </React.StrictMode>
  )
}

boot()
