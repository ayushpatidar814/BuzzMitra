import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { useAuth } from '../auth/AuthProvider'
import Avatar from './Avatar'

const StoryModel = lazy(() => import('./StoryModel'))
const StoryViewer = lazy(() => import('./StoryViewer'))

const getPreviewStory = (storyGroup) => storyGroup?.preview_story || storyGroup?.stories?.[0] || null

const formatStoryTime = (dateValue) => {
  if (!dateValue) return "Just now"
  const diff = Date.now() - new Date(dateValue).getTime()
  const minutes = Math.max(1, Math.floor(diff / 60000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const StoriesBar = ({ initialStories = null }) => {
  const { authHeaders } = useAuth()
  const [stories, setStories] = useState(initialStories || [])
  const [showModel, setShowModel] = useState(false)
  const [viewStory, setViewStory] = useState(null)
  const bootstrappedRef = useRef(Boolean(initialStories))

  const fetchStories = useCallback(async () => {
    try {
      const {data} = await api.getDedup('/api/story/get', { headers: authHeaders })
      if(data.success){
        setStories(data.stories)
      } else{
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
  }, [authHeaders])

  useEffect(() => {
    if (initialStories) {
      setStories(initialStories)
      bootstrappedRef.current = true
    }
  }, [initialStories])

  useEffect(() => {
    if (bootstrappedRef.current) {
      bootstrappedRef.current = false
      return
    }
    fetchStories()
  }, [fetchStories])

  return (
    <div className='mt-6 overflow-x-auto no-scrollbar'>
      <div className="flex gap-4 pb-2">
        <div onClick={()=> setShowModel(true)} className="flex h-36 w-28 shrink-0 cursor-pointer flex-col justify-between rounded-[1.4rem] border border-dashed border-lime-300/40 bg-slate-950 p-3 text-white">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-950">
            <Plus className='h-4 w-4' />
          </div>
          <div>
            <p className="text-xs font-semibold leading-snug">Add to your story</p>
            <p className="mt-1 text-[10px] leading-snug text-slate-400">Share a photo, video, or quick thought</p>
          </div>
        </div>

        {stories.map((storyGroup, groupIndex) => {
          const preview = getPreviewStory(storyGroup)
          if (!preview) return null
          const previewIndex = storyGroup.stories.findIndex((story) => story._id === preview._id)
          return (
          <button
            type="button"
            onClick={() => setViewStory({ groupIndex, storyIndex: Math.max(previewIndex, 0) })}
            key={storyGroup._id}
            className='relative h-36 w-28 shrink-0 overflow-hidden rounded-[1.4rem] bg-slate-900 text-white shadow-lg transition hover:-translate-y-1 hover:shadow-2xl'
          >
            {preview.media_type !== 'text' ? (
              preview.media_type === 'image' ? (
                <img src={preview.media_url} alt={preview.content || storyGroup.user.full_name} className="h-full w-full object-cover opacity-90" />
              ) : (
                <video
                  className="h-full w-full object-cover opacity-90"
                  src={preview.media_url}
                  muted
                  loop
                  autoPlay
                  playsInline
                  preload="metadata"
                />
              )
            ) : (
              <div className="h-full w-full" style={{ background: preview.background_color }} />
            )}

            <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/80" />

            <div className="absolute inset-x-0 top-0 p-2.5">
              <div className="mb-2 flex gap-1">
                {storyGroup.stories.slice(0, 5).map((story) => (
                  <span
                    key={story._id}
                    className={`h-1 flex-1 rounded-full ${story._id === preview._id ? "bg-white" : "bg-white/35"}`}
                  />
                ))}
              </div>

              <div className='flex items-center gap-2'>
                <Avatar src={storyGroup.user.profile_picture} alt={storyGroup.user.full_name} size="sm" className="border border-white/30" />
                <div className="min-w-0 text-left">
                  <p className='truncate text-xs font-semibold leading-none'>{storyGroup.user.full_name}</p>
                  <p className='mt-1 text-[10px] text-slate-200'>{formatStoryTime(preview.createdAt)}</p>
                </div>
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 p-2.5 text-left">
              <div className="rounded-[1rem] bg-black/35 p-2 backdrop-blur-sm">
                {/* <p className="text-[11px] uppercase tracking-[0.18em] text-white/65">Preview</p> */}
                {/* <p className="mt-1 line-clamp-2 text-sm font-medium">
                  {preview.content || (preview.media_type === "video" ? "Video story" : preview.media_type === "image" ? "Photo story" : "Story update")}
                </p> */}
                <p className="text-[10px] text-white/70">
                  {storyGroup.stories.length} stor{storyGroup.stories.length > 1 ? "ies" : "y"}
                </p>
              </div>
            </div>
          </button>
        )})}
      </div>

      { showModel && (
        <Suspense fallback={null}>
          <StoryModel setShowModel={setShowModel} fetchStories={fetchStories} />
        </Suspense>
      )}
      { viewStory && (
        <Suspense fallback={null}>
          <StoryViewer viewStory={viewStory} setViewStory={setViewStory} storyGroups={stories} />
        </Suspense>
      )}
    </div>
  )
}

export default StoriesBar
