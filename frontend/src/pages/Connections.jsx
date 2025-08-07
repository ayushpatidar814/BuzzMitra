import React from 'react'
import { Users, UserPlus, UserCheck, UserRoundPen, MessageSquare } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { fetchConnections } from '../features/connections/connectionsSlice'
import api from '../api/axios'
import toast from 'react-hot-toast'

const Connections = () => {

  const navigate = useNavigate();
  const { getToken } = useAuth();
  const dispatch = useDispatch();
  const {connections, pendingConnections, followers, following} = useSelector((state)=>state.connections)

  const [currentTab, setCurrentTab] = useState("Followers")

  const dataArray = [
    {label: 'Followers', value: followers, icon: Users},
    {label: 'Following', value: following, icon: UserCheck},
    {label: 'Pending', value: pendingConnections, icon: UserRoundPen},    
    {label: 'Connections', value: connections, icon: UserPlus},    
  ]

  const handleUnfollow = async (userId) => {
    try {
      const { data } = await api.post('/api/user/unfollow', {id: userId}, {
        headers: {Authorization: `Bearer ${await getToken()}`}
      })
      if (data.success){
        toast.success(data.message)
        dispatch(fetchConnections(await getToken()))
      } else{
        toast(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
  } 

  const acceptConnection = async (userId) => {
    try {
      const { data } = await api.post('/api/user/accept', {id: userId}, {
        headers: {Authorization: `Bearer ${await getToken()}`}
      })
      if (data.success){
        toast.success(data.message)
        dispatch(fetchConnections(await getToken()))
      } else{
        toast(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
  } 

  useEffect(() => {
    getToken().then((token)=>{
      dispatch(fetchConnections(token))
    })
  }, [])
  

  return (
    <div className='min-h-screen bg-slate-50'>
      <div className="max-w-6xl mx-auto p-6">

        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Connections</h1>
          <p className="text-slate-600">Manage your network and discover new connections</p>
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

        {/* Connections */}
        <div className="flex flex-wrap gap-6 mt-6">
          {dataArray.find((item)=> item.label === currentTab).value.map((user) => (
           <div key={user._id} className="w-full max-w-88 flex gap-5 p-6 bg-white rounded-md shadow">
              <img src={user.profile_picture} alt="profile_picture" className='rounded-full size-12 mx-auto shadow-md' />
              <div className='flex-1 w-full'>
                <p className='font-medium text-slate-700'>{user.full_name}</p>
                <p className='text-slate-500'>@{user.username}</p>
                <p className='text-sm text-gray-600'>{user.bio.slice(0, 30)}...</p>
                <div className="flex max-sm:flex-col gap-2 mt-4 w-full">  
                  {
                    <button onClick={()=>navigate(`/profile/${user._id}`)} className='w-full p-2 text-sm rounded bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 active:scale-95 transition cursor-pointer text-white'>
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
                    {
                      currentTab === 'Pending' && (
                        <button onClick={()=> acceptConnection(user._id)} className='w-full p-2 text-sm bg-red-100 rounded hover:bg-red-200 active:scale-95 transition cursor-pointer text-black'>
                          Accept
                        </button>
                      )
                    }
                  {
                    currentTab === 'Connections' && (
                      <button onClick={()=>navigate(`/messages/${user._id}`)} className='w-full p-2 text-sm bg-slate-100 rounded hover:bg-slate-200 active:scale-95 transition cursor-pointer flex items-center justify-center gap-1 text-slate-800'>
                        <MessageSquare className='w-4 h-4' />
                        Message
                      </button>
                    )
                  }
                </div>
              </div>
           </div> 
          ))}
        </div>
      </div>

    </div>
  )
}

export default Connections