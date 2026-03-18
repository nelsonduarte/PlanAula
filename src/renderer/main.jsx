import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Apply theme before render
const savedTheme = localStorage.getItem('tema') || 'light'
if (savedTheme === 'dark') {
  document.documentElement.classList.add('dark')
} else {
  document.documentElement.classList.remove('dark')
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
