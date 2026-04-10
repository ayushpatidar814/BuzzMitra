import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, Send, Verified, X } from 'lucide-react'
import api from '../api/axios'
import { useAuth } from '../auth/AuthProvider'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import Avatar from './Avatar'

const StoryViewer = ({viewStory, setViewStory, storyGroups = []}) => {
  const [progress, setProgress] = useState(0)
  const [viewerSheetOpen, setViewerSheetOpen] = useState(false)
  const [viewers, setViewers] = useState([])
  const [loadingViewers, setLoadingViewers] = useState(false)
  const [replyText, setReplyText] = useState("")
  const [sendingReply, setSendingReply] = useState(false)
  const { authHeaders } = useAuth()
  const loggedInUser = useSelector((state) => state.user.value)

  const currentGroup = storyGroups[viewStory?.groupIndex] || null
  const stories = currentGroup?.stories || []
  const currentStory = stories[viewStory?.storyIndex] || null
  const isOwner = useMemo(() => String(currentGroup?.user?._id) === String(loggedInUser?._id), [currentGroup?.user?._id, loggedInUser?._id])

  const goToStory = useCallback((direction) => {
    if (!storyGroups.length || !currentGroup || !currentStory) return

    const nextStoryIndex = viewStory.storyIndex + direction
    if (nextStoryIndex >= 0 && nextStoryIndex < stories.length) {
      setViewStory({ groupIndex: viewStory.groupIndex, storyIndex: nextStoryIndex })
      return
    }

    if (direction > 0) {
      const nextGroup = storyGroups[viewStory.groupIndex + 1]
      if (!nextGroup?.stories?.length) {
        setViewStory(null)
        return
      }
      setViewStory({ groupIndex: viewStory.groupIndex + 1, storyIndex: 0 })
      return
    }

    const previousGroup = storyGroups[viewStory.groupIndex - 1]
    if (!previousGroup?.stories?.length) return
    setViewStory({ groupIndex: viewStory.groupIndex - 1, storyIndex: previousGroup.stories.length - 1 })
  }, [currentGroup, currentStory, setViewStory, stories.length, storyGroups, viewStory])

  useEffect(() => {
    if (!currentStory?._id) return
    api.post('/api/story/view', { storyId: currentStory._id }, { headers: authHeaders }).catch(() => {})
  }, [currentStory?._id, authHeaders])

  useEffect(() => {
    setReplyText("")
    setViewerSheetOpen(false)
    setViewers([])
  }, [currentStory?._id])

  useEffect(() => {
    let timer
    let progressInterval
    if(currentStory) {
      setProgress(0)
      const duration = currentStory.duration_ms || (currentStory.media_type === "video" ? 45000 : 8000)
      const setTime = 100
      let elapsed = 0
      progressInterval = setInterval(() => {
        elapsed += setTime
        setProgress((elapsed / duration) * 100)
      }, setTime)

      if (currentStory.media_type !== "video") {
        timer = setTimeout(() => {
          goToStory(1)
        }, duration)
      }
    }
    return () => {
      clearTimeout(timer)
      clearInterval(progressInterval)
    }
  }, [currentStory, goToStory])

  if(!viewStory || !currentStory) return null

  const fetchViewers = async () => {
    if (!currentStory?._id || !isOwner) return

    try {
      setLoadingViewers(true)
      const { data } = await api.get(`/api/story/viewers/${currentStory._id}`, { headers: authHeaders })
      if (!data.success) throw new Error(data.message)
      setViewers(data.viewers || [])
      setViewerSheetOpen(true)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoadingViewers(false)
    }
  }

  const sendReply = async () => {
    if (!replyText.trim() || !currentStory?._id) return

    try {
      setSendingReply(true)
      const { data } = await api.post('/api/story/reply', {
        storyId: currentStory._id,
        text: replyText,
      }, { headers: authHeaders })

      if (!data.success) throw new Error(data.message)
      toast.success("Reply sent")
      setReplyText("")
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSendingReply(false)
    }
  }

  const renderContent = () => {
    switch(currentStory.media_type) {
      case 'text':
        return <div className="flex h-full w-full items-center justify-center p-8 text-center text-2xl text-white">{currentStory.content}</div>
      case 'image':
        return <img src={currentStory.media_url} alt={currentStory.content} className="max-h-[90vh] max-w-full object-contain" />
      case 'video':
        return <video onEnded={()=> goToStory(1)} src={currentStory.media_url} className='max-h-[90vh] w-full object-contain' autoPlay playsInline />
      default:
        return null
    }
  }

  return (
    <div className='fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-4 backdrop-blur' style={{backgroundColor: currentStory.media_type === 'text' ? currentStory.background_color : '#000000'}}>
      <button
        onClick={() => goToStory(-1)}
        className="absolute inset-y-0 left-0 z-30 w-1/2 cursor-pointer"
        aria-label="Previous story"
      />
      <button
        onClick={() => goToStory(1)}
        className="absolute inset-y-0 right-0 z-30 w-1/2 cursor-pointer"
        aria-label="Next story"
      />
      <div className="absolute left-0 top-0 h-1 w-full bg-gray-700">
        <div className="h-full bg-white transition-all duration-100" style={{width: `${progress}%`}} />
      </div>
      <div className="absolute left-4 top-4 z-40 flex items-center gap-3 rounded-2xl bg-black/40 p-3">
        <Avatar src={currentGroup?.user?.profile_picture} alt={currentGroup?.user?.full_name || "profile"} size="sm" />
        <div className="flex items-center gap-1.5 font-medium text-white">
          <span>{currentGroup?.user?.full_name}</span>
          <Verified size={18} />
        </div>
      </div>
      {isOwner && (
        <button
          onClick={fetchViewers}
          className="absolute bottom-5 left-4 z-40 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-4 py-2 text-sm text-white backdrop-blur"
        >
          <Eye className='h-4 w-4' />
          {loadingViewers ? "Loading..." : `${currentStory.viewers_count || 0} views`}
        </button>
      )}
      {!isOwner && (
        <div className="absolute inset-x-4 bottom-5 z-40">
          <div className="mx-auto flex max-w-md items-center gap-2 rounded-full border border-white/15 bg-black/45 px-4 py-2 text-white backdrop-blur">
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendReply()}
              placeholder={`Reply to ${currentGroup?.user?.full_name || "story"}...`}
              className="flex-1 bg-transparent text-sm outline-none text-slate-800 placeholder:text-white/60"
            />
            <button
              onClick={sendReply}
              disabled={sendingReply || !replyText.trim()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-950 disabled:opacity-50"
            >
              <Send className='h-4 w-4' />
            </button>
          </div>
        </div>
      )}
      <button onClick={() => setViewStory(null)} className="absolute right-4 top-4 z-40 text-white">
        <X className='h-8 w-8' />
      </button>
      <div className="relative z-20 max-h-[90vh] max-w-[90vw]">{renderContent()}</div>
      {viewerSheetOpen && (
        <div className="absolute inset-x-0 bottom-0 z-50 mx-auto w-full max-w-lg rounded-t-[2rem] border border-white/10 bg-[#090f1d] p-5 text-white shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-white/50">Story Views</p>
              <h3 className="mt-1 text-lg font-semibold">{currentStory.viewers_count || viewers.length} people viewed this story</h3>
            </div>
            <button onClick={() => setViewerSheetOpen(false)} className="rounded-full border border-white/10 p-2 text-white/70">
              <X className='h-4 w-4' />
            </button>
          </div>
          <div className="mt-4 max-h-72 space-y-3 overflow-y-auto no-scrollbar pr-1">
            {viewers.map((viewer) => (
              <div key={`${viewer._id}-${viewer.viewed_at}`} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-3">
                <Avatar src={viewer.profile_picture} alt={viewer.full_name} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{viewer.full_name}</p>
                  <p className="truncate text-xs text-white/60">@{viewer.username}</p>
                </div>
              </div>
            ))}
            {!loadingViewers && viewers.length === 0 && (
              <p className="rounded-2xl bg-white/[0.04] px-4 py-5 text-center text-sm text-white/60">No views yet for this story.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default StoryViewer
