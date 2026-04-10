import React from 'react'
import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import UserCard from '../components/UserCard'
import Loading from '../components/Loading'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { useAuth } from '../auth/AuthProvider'

const Discover = () => {
  const [input, setInput] = useState('')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const { authHeaders } = useAuth()

  useEffect(() => {
    const timeout = setTimeout(async () => {
      try {
        setLoading(true)
        const {data} = await api.post('/api/user/discover', {input}, { headers: authHeaders })
        data.success ? setUsers(data.users) : toast.error(data.message)
      } catch (error) {
        toast.error(error.message)
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(timeout)
  }, [input, authHeaders])
  
  return (
    <div className='min-h-screen bg-gradient-to-b from-slate-50 to-white'>
      <div className='max-w-6xl mx-auto p-6'>
        
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Discover People</h1>
          <p className="text-slate-600">Connect with amazing people and grow your network.</p>
        </div>

        {/* Search Bar */}
        <div className="mb-8 rounded-[2rem] border border-slate-200/60 bg-white/90 shadow-md">
          <div className="p-6">
            <div className="relative">
              <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5' />
              <input type="text" placeholder='Search people by name, username, bio, or location...' className='w-full rounded-2xl border border-gray-300 py-3 pl-10 sm:pl-12 max-sm:text-sm text-slate-800' onChange={(e)=>setInput(e.target.value)} value={input} />
            </div>
          </div>
        </div>

        <div className='flex flex-wrap gap-6'>
          {users.map((user) => (
            <UserCard user={user} key={user._id} />
          ))}
        </div>

        {
          loading && (<Loading height='60vh' />)
        }
      </div>
    </div>
  )
}

export default Discover
