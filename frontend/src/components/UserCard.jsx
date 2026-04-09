import React from 'react'
import { MapPin, MessageCircle, UserPlus } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { fetchUser } from '../features/user/userSlice'
import { useAuth } from '../auth/AuthProvider'
import Avatar from './Avatar'

const UserCard = ({user}) => {

    const currentUser = useSelector((state)=>state.user.value)
    const { authHeaders, token } = useAuth();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const isFollowing = currentUser?.following?.includes(user._id)
    const isFollower = currentUser?.followers?.includes(user._id)
    const canMessage = isFollowing || isFollower

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
    <div className='p-4 pt-6 flex flex-col justify-between w-72 shadow border border-gray-200 rounded-md'>
        <div className="text-center">
            <Avatar onClick={() => navigate(`/app/profile/${user._id}`)} src={user.profile_picture} alt={user.full_name} size="lg" className='mx-auto' />
            <p onClick={() => navigate(`/app/profile/${user._id}`)} className="mt-4 font-semibold cursor-pointer">{user.full_name}</p>
            {user.username && <p onClick={() => navigate(`/app/profile/${user._id}`)} className='text-gray-500 font-light cursor-pointer'>@{user.username}</p>}
            {user.bio && <p className='text-gray-600 mt-2 text-center text-sm px-4'>{user.bio}</p>}
        </div>
        
        <div className='flex items-center justify-center gap-2 mt-4 text-xs text-gray-600'>
            <div className="flex items-center gap-1 border border-gray-300 rounded-full px-3 py-1">
                <MapPin className='w-4 h-4' /> {user.location}
            </div>
            <div className="flex items-center gap-1 border border-gray-300 rounded-full px-3 py-1">
                <span>{user.followers_count ?? user.followers?.length ?? 0}</span>Followers
            </div>
        </div>

        <div className='flex mt-4 gap-2'>
            <button onClick={() => navigate(`/app/profile/${user._id}`)} className='w-full py-2 rounded-md flex justify-center items-center gap-2 border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 active:scale-95 transition cursor-pointer'>
                View Profile
            </button>
            
            {/* Follow Button */}
            <button onClick={handleFollow} className='w-full py-2 rounded-md flex justify-center items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo600 hover:to-purple-700 active:scale-95 transition cursor-pointer text-white'>
                <UserPlus className='w-4 h-4' />
                {isFollowing ? 'Following' : 'Follow'}
            </button>

            <button onClick={handleMessage} className='flex items-center justify-center w-16 border text-slate-500 group rounded-md active:scale-95 transition cursor-pointer'>
                <MessageCircle className='w-5 h-5 group-hover:scale-105 transition' />
            </button>
        </div>
    </div>
  )
}

export default UserCard
