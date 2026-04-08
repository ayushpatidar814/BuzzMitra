import React, { useCallback, useEffect, useState } from 'react'
import { useRef } from 'react'
import { useLocation } from 'react-router-dom'
import Loading from '../components/Loading'
import StoriesBar from '../components/StoriesBar'
import PostCard from '../components/PostCard'
import RecentMessages from '../components/RecentMessages'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { useAuth } from '../auth/AuthProvider'

const Feed = () => {
  const [feeds, setFeeds] = useState([])
  const [loading, setLoading] = useState(true)
  const { authHeaders } = useAuth()
  const { search } = useLocation()
  const highlightedPostId = new URLSearchParams(search).get("post")
  const postRefs = useRef({})

  const fetchFeeds = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/api/post/feed', { headers: authHeaders })
      if (data.success) {
        setFeeds(data.posts)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => {
    fetchFeeds()
  }, [fetchFeeds])

  useEffect(() => {
    if (!highlightedPostId || loading) return
    const target = postRefs.current[highlightedPostId]
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [highlightedPostId, loading, feeds])

  const handlePostDeleted = useCallback((postId) => {
    setFeeds((prev) => prev.filter((post) => post._id !== postId))
  }, [])

  return !loading ? (
    <div className='px-4 pb-12 pt-8 lg:px-8'>
      <div className='mx-auto grid max-w-7xl gap-8 xl:grid-cols-[minmax(0,1fr)_320px]'>
        <div className='flex flex-col items-center'>
          <div className='rounded-[2rem] border border-white/10 bg-slate-950/85 p-6 text-white shadow-2xl shadow-slate-950/30'>
            <p className='text-sm uppercase tracking-[0.24em] text-lime-300'>Home</p>
            <h1 className='mt-3 text-3xl font-semibold'>Catch up on stories, posts, and moments you care about.</h1>
            <p className='mt-3 max-w-2xl text-slate-300'>Keep up with people you follow, discover public updates, and jump back into what is trending around you.</p>
          </div>
          <div className='w-full max-w-3xl'>
            <StoriesBar />
          </div>
          <div className="mt-6 w-full max-w-3xl space-y-6">
            {feeds.map((post) => (
              <div
                key={post._id}
                ref={(node) => {
                  if (node) postRefs.current[post._id] = node
                }}
                className='mx-auto w-full max-w-3xl'
              >
                <PostCard post={post} onDeleted={handlePostDeleted} highlighted={highlightedPostId === post._id} />
              </div>
            ))}
          </div>
        </div>

        <div className='space-y-4 self-start xl:sticky xl:top-8'>
          <div className='rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/30'>
            <p className='text-xs uppercase tracking-[0.24em] text-slate-400'>Get discovered</p>
            <h3 className='mt-3 text-xl font-semibold text-slate-900'>Help the right people find your next reel.</h3>
            <p className='mt-2 text-sm text-slate-600'>Choose the right category and audience when you post so your content shows up in the most relevant feed.</p>
          </div>
          <RecentMessages />
        </div>
      </div>
    </div>
  ) : <Loading />
}

export default Feed
