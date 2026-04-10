import React from 'react'
import { Users, UserCheck, MessageSquare, Search, Sparkles, ArrowUpRight, Radar, UserRoundPlus } from 'lucide-react'
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
import { useThemeSettings } from '../theme/ThemeProvider'
import clsx from 'clsx'

const Connections = () => {

  const navigate = useNavigate();
  const { authHeaders, token } = useAuth();
  const dispatch = useDispatch();
  const {followers, following} = useSelector((state)=>state.connections)
  const { theme } = useThemeSettings()

  const [currentTab, setCurrentTab] = useState("Followers")
  const [input, setInput] = useState('')
  const [discoverUsers, setDiscoverUsers] = useState([])
  const [discoverLoading, setDiscoverLoading] = useState(false)
  const [showAllNetwork, setShowAllNetwork] = useState(false)
  const isLight = theme === "light"
  const isDark = theme === "dark"

  const dataArray = [
    {label: 'Followers', value: followers, icon: Users},
    {label: 'Following', value: following, icon: UserCheck},
  ]
  const currentUsers = dataArray.find((item)=> item.label === currentTab).value || []
  const totalNetwork = followers.length + following.length
  const discoverLabel = input.trim() ? "Search results" : "Suggested people"
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
    <div className={clsx('min-h-screen px-4 pb-12 pt-8 lg:px-8', isLight ? 'bg-[#f3f7ff]' : isDark ? 'bg-black' : 'bg-[radial-gradient(circle_at_top,_rgba(190,242,100,.12),_transparent_22%),linear-gradient(180deg,_#0f172a_0%,_#111827_22%,_#e2e8f0_22%,_#f8fafc_100%)]')}>
      <div className="mx-auto max-w-6xl">
        <div className={clsx("rounded-[2.2rem] border p-6 shadow-2xl", isLight ? "border-slate-200 bg-white/90 shadow-slate-200/35" : isDark ? "border-white/10 bg-white/[0.03] text-white shadow-black/35" : "border-white/10 bg-slate-950/85 text-white shadow-slate-950/30")}>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_320px]">
            <div>
              <div className={clsx("inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs uppercase tracking-[0.24em]", isLight ? "border-cyan-100 bg-cyan-50 text-cyan-700" : isDark ? "border-white/10 bg-white/6 text-white/70" : "border-white/10 bg-white/5 text-lime-200/80")}>
                <Sparkles className="h-4 w-4" />
                People
              </div>
              <h1 className={clsx("mt-5 text-4xl font-semibold tracking-tight sm:text-5xl", isLight ? "text-slate-900" : "text-white")}>
                Keep your circle close and discover fresh voices.
              </h1>
              <p className={clsx("mt-4 max-w-2xl text-sm leading-7", isLight ? "text-slate-600" : isDark ? "text-white/70" : "text-slate-300")}>
                Manage the people following you, the people you keep up with, and jump into new profiles that match your vibe, location, and interests.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => setCurrentTab("Followers")}
                  className={clsx("inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition", currentTab === "Followers"
                    ? "bg-lime-300 text-slate-950"
                    : isLight ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" : isDark ? "border border-white/10 bg-white/6 text-white hover:bg-white/10" : "border border-white/10 bg-white/5 text-white")}
                >
                  <Users className="h-4 w-4" />
                  Followers
                </button>
                <button
                  onClick={() => setCurrentTab("Following")}
                  className={clsx("inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition", currentTab === "Following"
                    ? "bg-cyan-300 text-slate-950"
                    : isLight ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" : isDark ? "border border-white/10 bg-white/6 text-white hover:bg-white/10" : "border border-white/10 bg-white/5 text-white")}
                >
                  <UserCheck className="h-4 w-4" />
                  Following
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className={clsx("rounded-[1.7rem] border p-5", isLight ? "border-slate-200 bg-slate-50" : isDark ? "border-white/10 bg-white/5" : "border-white/10 bg-white/5")}>
                <p className={clsx("text-xs uppercase tracking-[0.2em]", isLight ? "text-slate-500" : "text-white/45")}>Followers</p>
                <p className={clsx("mt-3 text-3xl font-semibold", isLight ? "text-slate-900" : "text-white")}>{followers.length}</p>
              </div>
              <div className={clsx("rounded-[1.7rem] border p-5", isLight ? "border-slate-200 bg-slate-50" : isDark ? "border-white/10 bg-white/5" : "border-white/10 bg-white/5")}>
                <p className={clsx("text-xs uppercase tracking-[0.2em]", isLight ? "text-slate-500" : "text-white/45")}>Following</p>
                <p className={clsx("mt-3 text-3xl font-semibold", isLight ? "text-slate-900" : "text-white")}>{following.length}</p>
              </div>
              <div className={clsx("rounded-[1.7rem] border p-5", isLight ? "border-slate-200 bg-slate-50" : isDark ? "border-white/10 bg-white/5" : "border-white/10 bg-white/5")}>
                <p className={clsx("text-xs uppercase tracking-[0.2em]", isLight ? "text-slate-500" : "text-white/45")}>Total circle</p>
                <p className={clsx("mt-3 text-3xl font-semibold", isLight ? "text-slate-900" : "text-white")}>{totalNetwork}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <div className={clsx("rounded-[2rem] border p-5 shadow-xl", isLight ? "border-slate-200 bg-white shadow-slate-200/30" : isDark ? "border-white/10 bg-white/[0.03] text-white shadow-black/25" : "border-slate-200/70 bg-white/92 shadow-slate-200/25")}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className={clsx("text-xs uppercase tracking-[0.22em]", isLight ? "text-slate-500" : isDark ? "text-white/45" : "text-slate-400")}>Your network</p>
                  <h2 className={clsx("mt-2 text-2xl font-semibold", isLight ? "text-slate-900" : isDark ? "text-white" : "text-slate-900")}>
                    {currentTab}
                  </h2>
                  <p className={clsx("mt-2 text-sm", isLight ? "text-slate-600" : isDark ? "text-white/68" : "text-slate-600")}>
                    Browse the people in this list, view profiles, message them, and manage your relationships cleanly.
                  </p>
                </div>

                <div className={clsx("inline-flex rounded-[1.2rem] p-1.5", isLight ? "bg-slate-100" : isDark ? "bg-white/6" : "bg-slate-100")}>
                  {dataArray.map((tab) => (
                    <button
                      onClick={()=> setCurrentTab(tab.label)}
                      key={tab.label}
                      className={clsx("flex items-center gap-2 rounded-[1rem] px-4 py-2.5 text-sm font-medium transition", currentTab === tab.label
                        ? (isLight ? "bg-white text-slate-950 shadow-sm" : isDark ? "bg-white text-black shadow-sm" : "bg-slate-950 text-white shadow-sm")
                        : (isLight ? "text-slate-500 hover:text-slate-900" : isDark ? "text-white/68 hover:text-white" : "text-slate-500 hover:text-slate-900"))}
                    >
                      <tab.icon className='h-4 w-4' />
                      <span>{tab.label}</span>
                      <span className={clsx("rounded-full px-2 py-0.5 text-[11px]", currentTab === tab.label ? "bg-black/10" : isLight ? "bg-white text-slate-500" : isDark ? "bg-white/10 text-white/70" : "bg-white text-slate-500")}>
                        {tab.value.length}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {visibleUsers.length > 0 ? visibleUsers.map((user) => (
                 <div key={user._id} className={clsx("group flex gap-4 rounded-[1.8rem] border p-5 transition", isLight ? "border-slate-200 bg-slate-50 hover:bg-white" : isDark ? "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]" : "border-slate-200 bg-slate-50 hover:bg-white")}>
                    <Avatar src={user.profile_picture} alt={user.full_name} size="sm" className={clsx(isDark ? "border border-white/10 bg-white/5" : "")} />
                    <div className='flex-1 w-full min-w-0'>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={clsx('truncate font-semibold', isLight ? 'text-slate-900' : isDark ? 'text-white' : 'text-slate-700')}>{user.full_name}</p>
                          <p className={clsx('truncate text-sm', isLight ? 'text-slate-500' : isDark ? 'text-white/52' : 'text-slate-500')}>@{user.username}</p>
                        </div>
                        <ArrowUpRight className={clsx("h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5", isDark ? "text-white/35" : "text-slate-300")} />
                      </div>
                      <p className={clsx('mt-2 min-h-10 text-sm leading-6', isLight ? 'text-slate-600' : isDark ? 'text-white/68' : 'text-slate-600')}>
                        {user.bio ? `${user.bio.slice(0, 88)}${user.bio.length > 88 ? '...' : ''}` : 'No bio yet. Visit the profile to know more about this person.'}
                      </p>
                      <div className='mt-3 flex flex-wrap gap-2 text-xs'>
                        {user.location && (
                          <span className={clsx("rounded-full px-3 py-1.5", isLight ? "border border-slate-200 bg-white text-slate-600" : isDark ? "border border-white/10 bg-white/6 text-white/72" : "border border-slate-200 bg-white text-slate-600")}>
                            {user.location}
                          </span>
                        )}
                        <span className={clsx("rounded-full px-3 py-1.5", isLight ? "border border-slate-200 bg-white text-slate-600" : isDark ? "border border-white/10 bg-white/6 text-white/72" : "border border-slate-200 bg-white text-slate-600")}>
                          {user.followers_count ?? 0} followers
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">  
                        <button onClick={()=>navigate(`/app/profile/${user._id}`)} className='rounded-2xl bg-gradient-to-r from-lime-300 via-cyan-300 to-fuchsia-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-105'>
                          View profile
                        </button>
                        {currentTab === 'Following' && (
                          <button onClick={()=> handleUnfollow(user._id)} className={clsx('rounded-2xl px-4 py-2.5 text-sm font-medium transition', isLight ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50' : isDark ? 'border border-white/10 bg-white/6 text-white hover:bg-white/10' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
                            Unfollow
                          </button>
                        )}
                        <button onClick={()=>openChat(user._id)} className={clsx('rounded-2xl px-4 py-2.5 text-sm font-medium transition flex items-center justify-center gap-2', isLight ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50' : isDark ? 'border border-white/10 bg-white/6 text-white hover:bg-white/10' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
                          <MessageSquare className='h-4 w-4' />
                          Message
                        </button>
                      </div>
                    </div>
                 </div> 
                )) : (
                  <div className={clsx("md:col-span-2 rounded-[1.8rem] border border-dashed px-6 py-12 text-center text-sm", isLight ? "border-slate-200 bg-slate-50 text-slate-500" : isDark ? "border-white/12 bg-white/[0.03] text-white/55" : "border-slate-200 bg-slate-50 text-slate-500")}>
                    No people to show in {currentTab.toLowerCase()} right now.
                  </div>
                )}
              </div>
              {currentUsers.length > previewLimit && (
                <div className="mt-5 flex justify-center">
                  <button
                    onClick={() => setShowAllNetwork((prev) => !prev)}
                    className={clsx("rounded-2xl px-5 py-3 text-sm font-medium shadow-sm transition", isLight ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" : isDark ? "border border-white/10 bg-white/6 text-white hover:bg-white/10" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}
                  >
                    {showAllNetwork ? 'Show less' : `Show more ${currentTab.toLowerCase()}`}
                  </button>
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-5">
            <div className={clsx("rounded-[2rem] border p-5 shadow-xl", isLight ? "border-slate-200 bg-white shadow-slate-200/30" : isDark ? "border-white/10 bg-white/[0.03] text-white shadow-black/25" : "border-white/10 bg-slate-950/85 text-white shadow-slate-950/25")}>
              <p className={clsx("inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em]", isLight ? "text-cyan-600" : isDark ? "text-white/50" : "text-lime-300")}>
                <Radar className="h-4 w-4" />
                People radar
              </p>
              <h2 className={clsx("mt-3 text-2xl font-semibold", isLight ? "text-slate-900" : "text-white")}>{discoverLabel}</h2>
              <p className={clsx("mt-2 text-sm leading-6", isLight ? "text-slate-600" : isDark ? "text-white/68" : "text-slate-300")}>
                Search by name, username, bio, or location to find people who match your current mood and interests.
              </p>

              <div className="relative mt-5">
                <Search className={clsx('absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5', isLight ? 'text-slate-400' : isDark ? 'text-white/35' : 'text-slate-400')} />
                <input
                  type="text"
                  placeholder='Search people, locations, or vibes...'
                  className={clsx('w-full rounded-[1.6rem] border py-3 pl-12 pr-4 text-sm outline-none transition', isLight ? 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white' : isDark ? 'border-white/10 bg-white/5 text-white placeholder:text-white/35 focus:bg-white/8' : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400')}
                  onChange={(e)=>setInput(e.target.value)}
                  value={input}
                />
              </div>
            </div>

            <div className={clsx("rounded-[2rem] border p-5 shadow-xl", isLight ? "border-slate-200 bg-white shadow-slate-200/30" : isDark ? "border-white/10 bg-white/[0.03] text-white shadow-black/25" : "border-slate-200/60 bg-white/90 shadow-slate-200/30")}>
              <p className={clsx("inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em]", isLight ? "text-slate-500" : isDark ? "text-white/50" : "text-slate-400")}>
                <UserRoundPlus className="h-4 w-4" />
                Discovery
              </p>
              {discoverLoading ? (
                <Loading height='26vh' />
              ) : (
                <div className='mt-5 grid gap-4'>
                  {discoverUsers.slice(0, 4).map((user) => (
                    <button
                      key={user._id}
                      type="button"
                      onClick={() => navigate(`/app/profile/${user._id}`)}
                      className={clsx("flex items-center gap-3 rounded-[1.4rem] border p-3 text-left transition", isLight ? "border-slate-200 bg-slate-50 hover:bg-white" : isDark ? "border-white/10 bg-white/5 hover:bg-white/8" : "border-slate-200 bg-slate-50 hover:bg-white")}
                    >
                      <Avatar src={user.profile_picture} alt={user.full_name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className={clsx("truncate font-medium", isLight ? "text-slate-900" : isDark ? "text-white" : "text-slate-900")}>{user.full_name}</p>
                        <p className={clsx("truncate text-sm", isLight ? "text-slate-500" : isDark ? "text-white/52" : "text-slate-500")}>@{user.username}</p>
                      </div>
                      <ArrowUpRight className={clsx("h-4 w-4", isDark ? "text-white/35" : "text-slate-300")} />
                    </button>
                  ))}
                  {!discoverUsers.length && (
                    <div className={clsx('rounded-2xl border border-dashed px-6 py-10 text-sm', isLight ? 'border-slate-200 bg-slate-50 text-slate-500' : isDark ? 'border-white/12 bg-white/[0.03] text-white/55' : 'border-slate-200 bg-slate-50 text-slate-500')}>
                      No matching people found right now.
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>

        <div className={clsx("mt-8 rounded-[2rem] border p-6 shadow-xl", isLight ? "border-slate-200 bg-white shadow-slate-200/30" : isDark ? "border-white/10 bg-white/[0.03] text-white shadow-black/25" : "border-slate-200/60 bg-white/92 shadow-slate-200/30")}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className={clsx("text-xs uppercase tracking-[0.22em]", isLight ? "text-slate-500" : isDark ? "text-white/50" : "text-slate-400")}>Discover more</p>
              <h2 className={clsx("mt-2 text-2xl font-semibold", isLight ? "text-slate-900" : isDark ? "text-white" : "text-slate-900")}>People worth checking out</h2>
            </div>
            {discoverUsers.length > 4 && (
              <p className={clsx("text-sm", isLight ? "text-slate-500" : isDark ? "text-white/55" : "text-slate-500")}>
                Showing {discoverUsers.length} people
              </p>
            )}
          </div>

          {discoverLoading ? (
            <Loading height='34vh' />
          ) : (
            <div className='mt-6 flex flex-wrap gap-6'>
              {discoverUsers.map((user) => (
                <UserCard user={user} key={user._id} />
              ))}
              {!discoverUsers.length && (
                <div className={clsx('w-full rounded-2xl border border-dashed px-6 py-12 text-sm', isLight ? 'border-slate-200 bg-slate-50 text-slate-500' : isDark ? 'border-white/12 bg-white/[0.03] text-white/55' : 'border-slate-200 bg-slate-50 text-slate-500')}>
                  Start typing above to search for new people around you.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Connections
