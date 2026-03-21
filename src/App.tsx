import { useNavigate } from 'react-router'
import './App.css'

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
