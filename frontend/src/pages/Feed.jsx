import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import StoriesBar from '../components/StoriesBar'
import PostCard from '../components/PostCard'
import RecentMessages from '../components/RecentMessages'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { useAuth } from '../auth/AuthProvider'
import clsx from 'clsx'
import { useThemeSettings } from '../theme/ThemeProvider'

const FeedSkeleton = () => (
  <div className='px-4 pb-12 pt-8 lg:px-8 animate-pulse'>
    <div className='mx-auto grid max-w-7xl gap-8 xl:grid-cols-[minmax(0,1fr)_320px]'>
      <div className='flex flex-col items-center'>
        <div className='w-full rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/20'>
          <div className='h-3 w-20 rounded-full bg-lime-300/30' />
          <div className='mt-4 h-8 w-3/4 rounded-full bg-white/12' />
          <div className='mt-3 h-4 w-full rounded-full bg-white/10' />
          <div className='mt-2 h-4 w-5/6 rounded-full bg-white/10' />
        </div>

        <div className='mt-6 flex w-full max-w-3xl gap-4 overflow-hidden'>
          <div className='h-56 w-36 shrink-0 rounded-[1.8rem] bg-slate-900/70' />
          <div className='h-56 w-36 shrink-0 rounded-[1.8rem] bg-slate-900/60' />
          <div className='h-56 w-36 shrink-0 rounded-[1.8rem] bg-slate-900/50' />
          <div className='h-56 w-36 shrink-0 rounded-[1.8rem] bg-slate-900/40' />
        </div>

        <div className='mt-6 w-full max-w-3xl space-y-6'>
          {[1, 2, 3].map((item) => (
            <div key={item} className='rounded-[2rem] border border-slate-200 bg-white/80 p-5 shadow-xl shadow-slate-200/20'>
              <div className='flex items-center gap-3'>
                <div className='h-12 w-12 rounded-2xl bg-slate-200' />
                <div className='flex-1'>
                  <div className='h-4 w-40 rounded-full bg-slate-200' />
                  <div className='mt-2 h-3 w-24 rounded-full bg-slate-100' />
                </div>
              </div>
              <div className='mt-5 h-4 w-11/12 rounded-full bg-slate-100' />
              <div className='mt-2 h-4 w-4/5 rounded-full bg-slate-100' />
              <div className='mt-5 aspect-[4/5] rounded-[1.6rem] bg-slate-100' />
              <div className='mt-5 flex gap-3'>
                <div className='h-10 w-20 rounded-full bg-slate-100' />
                <div className='h-10 w-20 rounded-full bg-slate-100' />
                <div className='h-10 w-20 rounded-full bg-slate-100' />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className='space-y-4 self-start xl:sticky xl:top-8'>
        <div className='rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/20'>
          <div className='h-3 w-24 rounded-full bg-slate-200' />
          <div className='mt-4 h-6 w-4/5 rounded-full bg-slate-200' />
          <div className='mt-3 h-4 w-full rounded-full bg-slate-100' />
          <div className='mt-2 h-4 w-5/6 rounded-full bg-slate-100' />
        </div>
        <div className='rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/20'>
          <div className='h-5 w-20 rounded-full bg-slate-200' />
          <div className='mt-4 space-y-4'>
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className='flex items-center gap-3'>
                <div className='h-10 w-10 rounded-2xl bg-slate-200' />
                <div className='flex-1'>
                  <div className='h-4 w-28 rounded-full bg-slate-200' />
                  <div className='mt-2 h-3 w-20 rounded-full bg-slate-100' />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
)

const Feed = () => {
  const [feeds, setFeeds] = useState([])
  const [stories, setStories] = useState([])
  const [recentChats, setRecentChats] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [bootstrappedSidebar, setBootstrappedSidebar] = useState(false)
  const { authHeaders } = useAuth()
  const { search } = useLocation()
  const highlightedPostId = new URLSearchParams(search).get("post")
  const postRefs = useRef({})
  const sentinelRef = useRef(null)
  const { theme } = useThemeSettings()
  const isLight = theme === "light"
  const isDark = theme === "dark"

  const fetchFeeds = useCallback(async (cursor = null, append = false) => {
    try {
      if (append) setLoadingMore(true)
      else setLoading(true)

      const { data } = await api.getDedup('/api/post/feed', {
        headers: authHeaders,
        params: {
          limit: 10,
          ...(cursor ? { cursor } : {}),
        },
      })

      if (data.success) {
        setFeeds((prev) => (append ? [...prev, ...(data.posts || [])] : (data.posts || [])))
        setNextCursor(data.nextCursor || null)
        setHasMore(Boolean(data.hasMore))
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [authHeaders])

  const fetchInitialFeedData = useCallback(async () => {
    try {
      setLoading(true)
      const [feedResponse, storiesResponse] = await Promise.all([
        api.getDedup('/api/post/feed', {
          headers: authHeaders,
          params: { limit: 10 },
        }),
        api.getDedup('/api/story/get', { headers: authHeaders }),
      ])

      const feedData = feedResponse.data
      const storiesData = storiesResponse.data

      if (!feedData.success) throw new Error(feedData.message)
      if (!storiesData.success) throw new Error(storiesData.message)

      setFeeds(feedData.posts || [])
      setNextCursor(feedData.nextCursor || null)
      setHasMore(Boolean(feedData.hasMore))
      setStories(storiesData.stories || [])
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  const fetchDeferredSidebarData = useCallback(async () => {
    try {
      const { data } = await api.getDedup('/api/chat/recent-messages', { headers: authHeaders })
      if (!data.success) throw new Error(data.message)
      setRecentChats(data.data || [])
      setBootstrappedSidebar(true)
    } catch (error) {
      toast.error(error.message)
    }
  }, [authHeaders])

  useEffect(() => {
    setFeeds([])
    setStories([])
    setRecentChats([])
    setBootstrappedSidebar(false)
    setNextCursor(null)
    setHasMore(true)
    fetchInitialFeedData()
  }, [fetchInitialFeedData])

  useEffect(() => {
    if (loading) return
    const timer = window.setTimeout(() => {
      fetchDeferredSidebarData()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [fetchDeferredSidebarData, loading])

  useEffect(() => {
    if (!highlightedPostId || loading) return
    const target = postRefs.current[highlightedPostId]
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [highlightedPostId, loading, feeds])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasMore || loading || loadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (first?.isIntersecting && nextCursor) {
          fetchFeeds(nextCursor, true)
        }
      },
      { rootMargin: '500px 0px' }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [fetchFeeds, hasMore, loading, loadingMore, nextCursor])

  const handlePostDeleted = useCallback((postId) => {
    setFeeds((prev) => prev.filter((post) => post._id !== postId))
  }, [])

  return !loading ? (
    <div className='px-4 pb-12 pt-8 lg:px-8'>
      <div className='mx-auto grid max-w-7xl gap-8 xl:grid-cols-[minmax(0,1fr)_320px]'>
        <div className='flex flex-col items-center'>
          <div className={clsx('rounded-[2rem] border p-6 shadow-2xl', isLight ? 'border-slate-200 bg-white/90 text-slate-900 shadow-slate-200/40' : isDark ? 'border-white/10 bg-black/82 text-white shadow-black/35' : 'border-white/10 bg-slate-950/85 text-white shadow-slate-950/30')}>
            <p className={clsx('text-sm uppercase tracking-[0.24em]', isLight ? 'text-cyan-600' : isDark ? 'text-white/58' : 'text-lime-300')}>Home</p>
            <h1 className='mt-3 text-3xl font-semibold'>Catch up on stories, posts, and moments you care about.</h1>
            <p className={clsx('mt-3 max-w-2xl', isLight ? 'text-slate-600' : isDark ? 'text-white/72' : 'text-slate-300')}>Keep up with people you follow, discover public updates, and jump back into what is trending around you.</p>
          </div>
          <div className='w-full max-w-3xl'>
            <StoriesBar initialStories={stories} />
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

            <div ref={sentinelRef} className='h-6' />

            {loadingMore && (
              <div className={clsx('rounded-[1.6rem] border px-5 py-4 text-center text-sm shadow-sm', isLight ? 'border-slate-200 bg-white/90 text-slate-500' : isDark ? 'border-white/10 bg-black/78 text-white/60' : 'border-white/10 bg-white/80 text-slate-500')}>
                Loading more posts...
              </div>
            )}

            {!hasMore && feeds.length > 0 && (
              <div className={clsx('rounded-[1.6rem] border px-5 py-4 text-center text-sm shadow-sm', isLight ? 'border-slate-200 bg-white/90 text-slate-500' : isDark ? 'border-white/10 bg-black/78 text-white/60' : 'border-white/10 bg-white/80 text-slate-500')}>
                You are all caught up for now.
              </div>
            )}
          </div>
        </div>

        <div className='space-y-4 self-start xl:sticky xl:top-8'>
          <div className={clsx('rounded-[2rem] border p-5 shadow-xl', isLight ? 'border-slate-200 bg-white shadow-slate-200/30' : isDark ? 'border-white/10 bg-black/80 text-white shadow-black/30' : 'border-white/10 bg-slate-950/70 text-white shadow-slate-950/20')}>
            <p className={clsx('text-xs uppercase tracking-[0.24em]', isLight ? 'text-cyan-600' : isDark ? 'text-white/58' : 'text-lime-300')}>Get discovered</p>
            <h3 className={clsx('mt-3 text-xl font-semibold', isLight ? 'text-slate-900' : 'text-white')}>Help the right people find your next reel.</h3>
            <p className={clsx('mt-2 text-sm', isLight ? 'text-slate-600' : isDark ? 'text-white/68' : 'text-slate-300')}>Choose the right category and audience when you post so your content shows up in the most relevant feed.</p>
          </div>
          <RecentMessages initialChats={bootstrappedSidebar ? recentChats : null} suspendInitialFetch={!bootstrappedSidebar} />
        </div>
      </div>
    </div>
  ) : <FeedSkeleton />
}

export default Feed
