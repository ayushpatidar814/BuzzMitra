import React from 'react'
import './index.css'
import App from './App.jsx'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { store } from './features/index.js'
import { AuthProvider } from './auth/AuthProvider.jsx'
import { ThemeProvider } from './theme/ThemeProvider.jsx'

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
  <Provider store={store}>
    <ThemeProvider>
      <AuthProvider>
      <App />
      </AuthProvider>
    </ThemeProvider>
  </Provider>
  </BrowserRouter>
);
