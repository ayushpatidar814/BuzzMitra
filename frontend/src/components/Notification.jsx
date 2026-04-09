import React from 'react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import Avatar from './Avatar'

const Notification = ({ t, notification }) => {

    const navigate = useNavigate()
    const actor = notification?.actor

  return (
    <div className={`max-w-md w-full bg-white shadow-lg flex rounded-2xl border-gray-300 hover:scale-105 transition`}>
        <div className="flex-1 p-4">
            <div className="flex items-start">
                <Avatar src={actor?.profile_picture} alt={actor?.full_name} size="sm" className='mt-0.5 flex-shrink-0' />
                <div className='ml-3 flex-1'>
                    <p className="text-sm font-medium text-gray-900">{notification?.title || actor?.full_name || 'New notification'}</p>
                    <p className="text-sm text-gray-900">{notification?.text?.slice(0, 70) || 'Open to view more details.'}</p>
                </div>
            </div>
        </div>
        <div className='flex rounded-2xl border-gray-200'>
            <button onClick={()=>{
                navigate(notification?.link || '/app/notifications');
                toast.dismiss(t.id)
            }} className='p-4 text-indigo-600 font-semibold'>
                Open
            </button>
        </div>
    </div>
  )
}

export default Notification
