import React, { useState } from 'react'
import Sidebar from '../components/Sidebar'
import { Outlet } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Loading from '../components/Loading'
import { useSelector } from 'react-redux'

const Layout = () => {
  const user = useSelector((state)=>state.user.value)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return user ? (
    <div className='w-full flex min-h-screen bg-[radial-gradient(circle_at_top,_rgba(190,242,100,.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(34,211,238,.12),_transparent_26%),linear-gradient(180deg,_#0f172a_0%,_#111827_38%,_#0f172a_100%)]'>
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className='flex-1 min-h-screen'>
        <Outlet />
      </div>
      {sidebarOpen ? (
        <X className='absolute top-3 right-3 p-2 z-50 bg-white rounded-md shadow w-10 h-10 text-gray-600 sm:hidden' onClick={() => setSidebarOpen(false) } />
      ) : (
        <Menu className='absolute top-3 right-3 p-2 z-50 bg-white rounded-md shadow h-10 w-10 text-gray-700 sm:hidden' onClick={() => setSidebarOpen(true) } />
      )}
    </div>
  ) : (
    <Loading />
  )
}

export default Layout
