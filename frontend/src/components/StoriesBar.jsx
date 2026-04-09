import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { useAuth } from '../auth/AuthProvider'
import Avatar from './Avatar'

const StoryModel = lazy(() => import('./StoryModel'))
const StoryViewer = lazy(() => import('./StoryViewer'))

const StoriesBar = ({ initialStories = null }) => {
  const { authHeaders } = useAuth()
  const [stories, setStories] = useState(initialStories || [])
  const [showModel, setShowModel] = useState(false)
  const [viewStory, setViewStory] = useState(null)
  const bootstrappedRef = useRef(Boolean(initialStories))

  const fetchStories = useCallback(async () => {
    try {
      const {data} = await api.get('/api/story/get', { headers: authHeaders })
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
        <div onClick={()=> setShowModel(true)} className="flex h-56 w-36 shrink-0 cursor-pointer flex-col justify-between rounded-[1.8rem] border border-dashed border-lime-300/40 bg-slate-950 p-4 text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-950">
            <Plus className='h-5 w-5' />
          </div>
          <div>
            <p className="text-sm font-semibold">Add to your story</p>
            <p className="mt-1 text-xs text-slate-400">Share a photo, video, or quick thought</p>
          </div>
        </div>

        {stories.map((storyGroup) => {
          const preview = storyGroup.preview_story
          const previewIndex = storyGroup.stories.findIndex((story) => story._id === preview._id)
          return (
          <div onClick={() => setViewStory({ groupIndex: stories.findIndex((group) => group._id === storyGroup._id), storyIndex: Math.max(previewIndex, 0) })} key={storyGroup._id} className='relative h-56 w-36 shrink-0 cursor-pointer overflow-hidden rounded-[1.8rem] bg-slate-900 text-white shadow-lg'>
            {preview.media_type !== 'text' ? (
              preview.media_type === 'image' ? (
                <img src={preview.media_url} alt={preview.content} className="h-full w-full object-cover opacity-80" />
              ) : (
                <video className="h-full w-full object-cover opacity-80">
                  <source src={preview.media_url} type="video/mp4" />
                </video>
              )
            ) : (
              <div className="h-full w-full" style={{ background: preview.background_color }} />
            )}
            <div className='absolute inset-x-0 top-0 flex items-center gap-2 p-3'>
              <Avatar src={storyGroup.user.profile_picture} alt={storyGroup.user.full_name} size="sm" className="border border-white/30" />
              <div>
                <p className='text-sm font-semibold'>{storyGroup.user.full_name}</p>
                <p className='text-xs text-slate-200'>{storyGroup.stories.length} stor{storyGroup.stories.length > 1 ? "ies" : "y"}</p>
              </div>
            </div>
            <p className="absolute inset-x-0 bottom-0 line-clamp-3 bg-gradient-to-t from-black to-transparent p-3 text-sm">{preview.content}</p>
          </div>
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
