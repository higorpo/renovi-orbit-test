import { useNavigate } from 'react-router'
import { Capacitor } from '@capacitor/core'
import { Device } from '@capacitor/device'
import './App.css'
import { useCallback, useEffect, useState } from 'react'
import {
  getWebPushPermission,
  setupPushNotifications,
  type PushPlatform,
  type WebPushPermission,
  type PushSetupResult,
} from './lib/push'

function mapPermissionForUi(
  permission: PushSetupResult['permission'],
): WebPushPermission | null {
  if (!permission) return null
  if (permission === 'prompt') return 'default'
  return permission
}
import { isFirebaseConfigured } from './lib/firebase/config'
import { logger } from './lib/logger'

function App() {
  const navigate = useNavigate()

  return (
    <div className="max-w-[1280px] mx-auto px-8 py-8 text-center">
      <h1>Renovi</h1>
    
      <button onClick={() => navigate('/login')}>Login</button>
    </div>
  )
}

export default App
