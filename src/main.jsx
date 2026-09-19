import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './store/AuthContext'
import { MatchProvider } from './store/MatchContext'

createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <MatchProvider>
      <App />
    </MatchProvider>
  </AuthProvider>,
)
