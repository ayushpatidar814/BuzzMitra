import React, { useState } from 'react'
import Sidebar from '../components/Sidebar'
import { Outlet } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Loading from '../components/Loading'
import { useSelector } from 'react-redux'
import clsx from 'clsx'
import { useThemeSettings } from '../theme/ThemeProvider'

const Layout = () => {
  const user = useSelector((state)=>state.user.value)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { theme } = useThemeSettings()
  const isLight = theme === "light"
  const isDark = theme === "dark"

  return user ? (
    <div className={clsx('w-full flex min-h-screen transition-colors duration-300', isLight
      ? 'bg-[radial-gradient(circle_at_top,_rgba(190,242,100,.16),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(34,211,238,.1),_transparent_22%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_48%,_#f8fafc_100%)]'
      : isDark
        ? 'bg-[radial-gradient(circle_at_top,_rgba(255,255,255,.08),_transparent_22%),linear-gradient(180deg,_#000_0%,_#050505_42%,_#000_100%)]'
        : 'bg-[radial-gradient(circle_at_top,_rgba(190,242,100,.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(34,211,238,.12),_transparent_26%),linear-gradient(180deg,_#0f172a_0%,_#111827_38%,_#0f172a_100%)]')}>
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className='flex-1 min-h-screen'>
        <Outlet />
      </div>
      {sidebarOpen ? (
        <X className={clsx('absolute top-3 right-3 p-2 z-50 rounded-md shadow w-10 h-10 sm:hidden', isLight ? 'bg-white text-slate-700 shadow-slate-200/60' : isDark ? 'bg-black text-white border border-white/10 shadow-black/50' : 'bg-white text-gray-600')} onClick={() => setSidebarOpen(false) } />
      ) : (
        <Menu className={clsx('absolute top-3 right-3 p-2 z-50 rounded-md shadow h-10 w-10 sm:hidden', isLight ? 'bg-white text-slate-700 shadow-slate-200/60' : isDark ? 'bg-black text-white border border-white/10 shadow-black/50' : 'bg-white text-gray-700')} onClick={() => setSidebarOpen(true) } />
      )}
    </div>
  ) : (
    <Loading />
  )
}

export default Layout
