import { useNavigate } from 'react-router'
import { Capacitor } from '@capacitor/core'
import { Device } from '@capacitor/device'
import './App.css'
import { useEffect, useState } from 'react'

function App() {
  const navigate = useNavigate()

  const [deviceInfo, setDeviceInfo] = useState<string | null>(null);

  const isNative = Capacitor.isNativePlatform(); 
  const platform = Capacitor.getPlatform();

  const logDeviceInfo = async () => {
    const info = await Device.getInfo();
    setDeviceInfo(JSON.stringify(info));
  };  

  useEffect(() => {
    logDeviceInfo();
  }, []);

  return (
    <div className="max-w-[1280px] mx-auto px-8 py-8 text-center">
      <h1>Renovi</h1>
      <p>Platform: {platform}</p>
      <p>Info: {deviceInfo}</p>
      {isNative ? <p>Native</p> : <p>Web</p>}
      <button onClick={() => navigate('/login')}>Login</button>
    </div>
  )
}

export default App
