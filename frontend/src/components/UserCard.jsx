import React from 'react'
import { MapPin, MessageCircle, UserPlus } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { fetchUser } from '../features/user/userSlice'
import { useAuth } from '../auth/AuthProvider'
import Avatar from './Avatar'
import { useThemeSettings } from '../theme/ThemeProvider'
import clsx from 'clsx'

const UserCard = ({user}) => {

    const currentUser = useSelector((state)=>state.user.value)
    const { authHeaders, token } = useAuth();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const isFollowing = currentUser?.following?.includes(user._id)
    const isFollower = currentUser?.followers?.includes(user._id)
    const canMessage = isFollowing || isFollower
    const { theme } = useThemeSettings()
    const isLight = theme === "light"
    const isDark = theme === "dark"

    const handleFollow = async () => {
        try {
            const endpoint = isFollowing ? '/api/user/unfollow' : '/api/user/follow'
            const { data } = await api.post(endpoint, {id: user._id}, {
                headers: authHeaders
            })
            if(data.success){
                toast.success(data.message)
                dispatch(fetchUser(token))
            } else{
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    const handleMessage = async () => {
        if(!canMessage){
            toast.error("Follow this user first to start chatting")
            return
        }
        try {
            const { data } = await api.post('/api/chat/chat', { receiverId: user._id }, { headers: authHeaders })
            if (data.success) {
                navigate('/app/messages/' + data.data._id)
                return
            }
            toast.error(data.message)
        } catch (error) {
            toast.error(error.message)
        }
    }

  return (
    <div className={clsx('w-72 rounded-[1.8rem] border p-4 pt-6 shadow-xl transition', isLight ? 'border-slate-200 bg-white shadow-slate-200/30' : isDark ? 'border-white/10 bg-white/[0.03] text-white shadow-black/25' : 'border-slate-200 bg-white shadow-slate-200/30')}>
        <div className="text-center">
            <Avatar onClick={() => navigate(`/app/profile/${user._id}`)} src={user.profile_picture} alt={user.full_name} size="lg" className={clsx('mx-auto', isDark ? 'border border-white/10 bg-white/5' : '')} />
            <p onClick={() => navigate(`/app/profile/${user._id}`)} className={clsx("mt-4 cursor-pointer font-semibold", isLight ? "text-slate-900" : isDark ? "text-white" : "text-slate-900")}>{user.full_name}</p>
            {user.username && <p onClick={() => navigate(`/app/profile/${user._id}`)} className={clsx('cursor-pointer font-light', isLight ? 'text-slate-500' : isDark ? 'text-white/48' : 'text-gray-500')}>@{user.username}</p>}
            {user.bio && <p className={clsx('mt-2 text-center text-sm px-4', isLight ? 'text-slate-600' : isDark ? 'text-white/68' : 'text-gray-600')}>{user.bio}</p>}
        </div>
        
        <div className={clsx('mt-4 flex items-center justify-center gap-2 text-xs', isLight ? 'text-slate-600' : isDark ? 'text-white/68' : 'text-gray-600')}>
            <div className={clsx("flex items-center gap-1 rounded-full px-3 py-1", isLight ? "border border-slate-200 bg-slate-50" : isDark ? "border border-white/10 bg-white/6" : "border border-gray-300")}>
                <MapPin className='w-4 h-4' /> {user.location}
            </div>
            <div className={clsx("flex items-center gap-1 rounded-full px-3 py-1", isLight ? "border border-slate-200 bg-slate-50" : isDark ? "border border-white/10 bg-white/6" : "border border-gray-300")}>
                <span>{user.followers_count ?? user.followers?.length ?? 0}</span>Followers
            </div>
        </div>

        <div className='flex mt-4 gap-2'>
            <button onClick={() => navigate(`/app/profile/${user._id}`)} className={clsx('w-full py-2 rounded-xl flex justify-center items-center gap-2 active:scale-95 transition cursor-pointer', isLight ? 'border border-slate-300 text-slate-700 bg-white hover:bg-slate-50' : isDark ? 'border border-white/10 text-white bg-white/6 hover:bg-white/10' : 'border border-slate-300 text-slate-700 bg-white hover:bg-slate-50')}>
                View Profile
            </button>
            
            <button onClick={handleFollow} className='w-full py-2 rounded-xl flex justify-center items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:brightness-110 active:scale-95 transition cursor-pointer text-white'>
                <UserPlus className='w-4 h-4' />
                {isFollowing ? 'Following' : 'Follow'}
            </button>

            <button onClick={handleMessage} className={clsx('group flex w-16 items-center justify-center rounded-xl border active:scale-95 transition cursor-pointer', isLight ? 'border-slate-300 text-slate-500' : isDark ? 'border-white/10 text-white/72 bg-white/6 hover:bg-white/10' : 'border-slate-300 text-slate-500')}>
                <MessageCircle className='w-5 h-5 group-hover:scale-105 transition' />
            </button>
        </div>
    </div>
  )
}

export default UserCard
