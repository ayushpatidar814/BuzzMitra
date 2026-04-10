import React from 'react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import Avatar from './Avatar'
import { useThemeSettings } from '../theme/ThemeProvider'
import clsx from 'clsx'

const Notification = ({ t, notification }) => {

    const navigate = useNavigate()
    const { theme } = useThemeSettings()
    const actor = notification?.actor
    const isLight = theme === "light"
    const isDark = theme === "dark"

  return (
    <div className={clsx(`max-w-md w-full shadow-lg flex rounded-2xl hover:scale-105 transition`, isLight ? "bg-white border border-slate-200" : isDark ? "bg-black border border-white/10 text-white" : "bg-white border border-gray-300")}>
        <div className="flex-1 p-4">
            <div className="flex items-start">
                <Avatar src={actor?.profile_picture} alt={actor?.full_name} size="sm" className='mt-0.5 flex-shrink-0' />
                <div className='ml-3 flex-1'>
                    <p className={clsx("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>{notification?.title || actor?.full_name || 'New notification'}</p>
                    <p className={clsx("text-sm", isDark ? "text-white/72" : "text-gray-900")}>{notification?.text?.slice(0, 70) || 'Open to view more details.'}</p>
                </div>
            </div>
        </div>
        <div className={clsx('flex rounded-2xl', isDark ? 'border-white/10' : 'border-gray-200')}>
            <button onClick={()=>{
                navigate(notification?.link || '/app/notifications');
                toast.dismiss(t.id)
            }} className={clsx('p-4 font-semibold', isDark ? 'text-white' : 'text-indigo-600')}>
                Open
            </button>
        </div>
    </div>
  )
}

export default Notification
