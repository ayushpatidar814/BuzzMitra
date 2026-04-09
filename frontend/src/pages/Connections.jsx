import React from 'react'
import { Users, UserCheck, MessageSquare, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { useState, useEffect } from 'react'
import { fetchConnections } from '../features/connections/connectionsSlice'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { useAuth } from '../auth/AuthProvider'
import UserCard from '../components/UserCard'
import Loading from '../components/Loading'
import Avatar from '../components/Avatar'

const Connections = () => {

  const navigate = useNavigate();
  const { authHeaders, token } = useAuth();
  const dispatch = useDispatch();
  const {followers, following} = useSelector((state)=>state.connections)

  const [currentTab, setCurrentTab] = useState("Followers")
  const [input, setInput] = useState('')
  const [discoverUsers, setDiscoverUsers] = useState([])
  const [discoverLoading, setDiscoverLoading] = useState(false)
  const [showAllNetwork, setShowAllNetwork] = useState(false)

  const dataArray = [
    {label: 'Followers', value: followers, icon: Users},
    {label: 'Following', value: following, icon: UserCheck},
  ]
  const currentUsers = dataArray.find((item)=> item.label === currentTab).value || []
  const previewLimit = 4
  const visibleUsers = showAllNetwork ? currentUsers : currentUsers.slice(0, previewLimit)

  const handleUnfollow = async (userId) => {
    try {
      const { data } = await api.post('/api/user/unfollow', {id: userId}, {
        headers: authHeaders
      })
      if (data.success){
        toast.success(data.message)
        dispatch(fetchConnections(token))
      } else{
        toast(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
  } 

  const openChat = async (userId) => {
    try {
      const { data } = await api.post('/api/chat/chat', { receiverId: userId }, { headers: authHeaders })
      if (data.success) navigate(`/app/messages/${data.data._id}`)
      else toast.error(data.message)
    } catch (error) {
      toast.error(error.message)
    }
  }

  useEffect(() => {
    if (token) dispatch(fetchConnections(token))
  }, [token, dispatch])

  useEffect(() => {
    setShowAllNetwork(false)
  }, [currentTab])

  useEffect(() => {
    const timeout = setTimeout(async () => {
      try {
        setDiscoverLoading(true)
        const { data } = await api.post('/api/user/discover', { input }, { headers: authHeaders })
        if (data.success) {
          setDiscoverUsers(data.users)
        } else {
          toast.error(data.message)
        }
      } catch (error) {
        toast.error(error.message)
      } finally {
        setDiscoverLoading(false)
      }
    }, 250)

    return () => clearTimeout(timeout)
  }, [input, authHeaders])
  

  return (
    <div className='min-h-screen bg-slate-50'>
      <div className="max-w-6xl mx-auto p-6">

        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">People</h1>
          <p className="text-slate-600">Manage your followers, the people you follow, and discover new people to connect with.</p>
        </div>
        
        {/* Count */}
        <div className="mb-8 flex flex-wrap gap-6">
          {dataArray.map((item, index) => (
            <div key={index} className="flex flex-col items-center justify-center gap-1 bg-white rounded-md shadow w-40 h-20">
              <b>{item.value.length}</b>
              <p className="text-slate-600">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="inline-flex flex-wrap items-center border border-gray-200 rounded-md p-1 bg-white shadow-sm">
          {
            dataArray.map((tab) => (
              <button onClick={()=> setCurrentTab(tab.label)} key={tab.label} className={`flex items-center px-3 py-1 rounded-md text-sm font-medium transition-colors cursor-pointer ${currentTab === tab.label ? 'bg-white text-black font-medium' : 'text-gray-500 hover:bg-text-black'}`}>
                <tab.icon className='w-4 h-4' />
                <span className='ml-1'>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className='ml-1 text-xs bg-indigo-100 text-indigo-600 rounded-full px-2 py-0.5'>
                    {tab.count}
                  </span>
                )}
              </button>
            ))
          }
        </div>

        {/* Network */}
        <div className="grid gap-6 mt-6 md:grid-cols-2">
          {visibleUsers.map((user) => (
           <div key={user._id} className="w-full max-w-88 flex gap-5 p-6 bg-white rounded-md shadow">
              <Avatar src={user.profile_picture} alt={user.full_name} size="sm" />
              <div className='flex-1 w-full'>
                <p className='font-medium text-slate-700'>{user.full_name}</p>
                <p className='text-slate-500'>@{user.username}</p>
                <p className='text-sm text-gray-600'>{user.bio.slice(0, 30)}...</p>
                <div className="flex max-sm:flex-col gap-2 mt-4 w-full">  
                  {
                    <button onClick={()=>navigate(`/app/profile/${user._id}`)} className='w-full p-2 text-sm rounded bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 active:scale-95 transition cursor-pointer text-white'>
                      View Profile
                    </button>
                  }
                  {
                    currentTab === 'Following' && (
                      <button onClick={()=> handleUnfollow(user._id)} className='w-full p-2 text-sm bg-slate-100 rounded hover:bg-slate-200 active:scale-95 transition cursor-pointer text-black'>
                        Unfollow
                      </button>
                    )
                  }
                  <button onClick={()=>openChat(user._id)} className='w-full p-2 text-sm bg-slate-100 rounded hover:bg-slate-200 active:scale-95 transition cursor-pointer flex items-center justify-center gap-1 text-slate-800'>
                    <MessageSquare className='w-4 h-4' />
                    Message
                  </button>
                </div>
              </div>
           </div> 
          ))}
        </div>
        {currentUsers.length > previewLimit && (
          <div className="mt-5 flex justify-center">
            <button
              onClick={() => setShowAllNetwork((prev) => !prev)}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              {showAllNetwork ? 'Show less' : `Show more ${currentTab.toLowerCase()}`}
            </button>
          </div>
        )}

        <div className="mt-12 rounded-[2rem] border border-slate-200/60 bg-white/90 shadow-md">
          <div className="border-b border-slate-100 p-6">
            <h2 className="text-2xl font-semibold text-slate-900">Discover people</h2>
            <p className="mt-2 text-sm text-slate-600">Search by name, username, bio, or location and start following people from here.</p>
          </div>

          <div className="p-6">
            <div className="relative">
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5' />
              <input
                type="text"
                placeholder='Search by name, username, bio, or location...'
                className='w-full rounded-2xl border border-gray-300 py-3 pl-10 sm:pl-12 max-sm:text-sm'
                onChange={(e)=>setInput(e.target.value)}
                value={input}
              />
            </div>

            {discoverLoading ? (
              <Loading height='30vh' />
            ) : (
              <div className='mt-6 flex flex-wrap gap-6'>
                {discoverUsers.map((user) => (
                  <UserCard user={user} key={user._id} />
                ))}
                {!discoverUsers.length && (
                  <div className='rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-sm text-slate-500'>
                    No matching people found right now.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}

export default Connections
