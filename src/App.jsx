import { useState } from 'react'
import LoginPage from './LoginPage.jsx'
import IncomeMonitor from './IncomeMonitor.jsx'

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('im_user')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })

  const handleLogin = (userData) => {
    localStorage.setItem('im_user', JSON.stringify(userData))
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem('im_user')
    setUser(null)
  }

  if (!user) return <LoginPage onLogin={handleLogin} />
  return <IncomeMonitor user={user} onLogout={handleLogout} />
}
