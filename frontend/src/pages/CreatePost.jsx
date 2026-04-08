import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Film, Image, Music2, Pause, Play, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSelector } from 'react-redux'
import api from '../api/axios'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import Avatar from '../components/Avatar'

const REEL_TRACKS = [
  { id: "track-1", title: "Neon Run", artist: "BuzzMitra Sounds", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { id: "track-2", title: "Night Drift", artist: "BuzzMitra Sounds", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
  { id: "track-3", title: "City Bloom", artist: "BuzzMitra Sounds", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
  { id: "track-4", title: "Wave Pop", artist: "BuzzMitra Sounds", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" },
]

const CreatePost = () => {
  const navigate = useNavigate()
  const user = useSelector((state)=>state.user.value)
  const { authHeaders } = useAuth()

  const [mode, setMode] = useState("post")
  const [content, setContent] = useState('')
  const [caption, setCaption] = useState('')
  const [images, setImages] = useState([])
  const [meta, setMeta] = useState({ category: "", sub_category: "", target_audience: "", duration_seconds: 0, visibility: "public" })
  const [selectedTrackId, setSelectedTrackId] = useState("")
  const [customMusicFile, setCustomMusicFile] = useState(null)
  const [playingTrackUrl, setPlayingTrackUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const audioRef = useRef(null)
  const customTrackObjectUrlRef = useRef("")

  const selectedTrack = useMemo(
    () => REEL_TRACKS.find((track) => track.id === selectedTrackId) || null,
    [selectedTrackId]
  )

  useEffect(() => {
    const audio = audioRef.current
    return () => {
      if (audio) {
        audio.pause()
      }
      if (customTrackObjectUrlRef.current) {
        URL.revokeObjectURL(customTrackObjectUrlRef.current)
      }
    }
  }, [])

  const resetAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current.removeAttribute("src")
      audioRef.current.load()
    }
    setPlayingTrackUrl("")
  }

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setImages([])
    setMeta((prev) => ({ ...prev, duration_seconds: 0 }))
    setSelectedTrackId("")
    setCustomMusicFile(null)
    resetAudio()
  }

  const handleReelUpload = (file) => {
    if (!file) return
    const probe = document.createElement("video")
    probe.preload = "metadata"
    probe.onloadedmetadata = () => {
      window.URL.revokeObjectURL(probe.src)
      const duration = Math.ceil(probe.duration || 0)
      if (duration > 45) {
        toast.error("Reel duration must be 45 seconds or less")
        setImages([])
        return
      }
      setMeta((prev) => ({ ...prev, duration_seconds: duration }))
      setImages([file])
    }
    probe.src = URL.createObjectURL(file)
  }

  const togglePreviewTrack = (track) => {
    if (!audioRef.current) return

    if (playingTrackUrl === track.url) {
      resetAudio()
      return
    }

    audioRef.current.src = track.url
    audioRef.current.play().catch(() => {})
    setPlayingTrackUrl(track.url)
  }

  const handleCustomMusicUpload = (file) => {
    if (!file || !audioRef.current) return

    if (customTrackObjectUrlRef.current) {
      URL.revokeObjectURL(customTrackObjectUrlRef.current)
    }

    const objectUrl = URL.createObjectURL(file)
    customTrackObjectUrlRef.current = objectUrl
    setCustomMusicFile(file)
    setSelectedTrackId("")
    audioRef.current.src = objectUrl
    audioRef.current.play().catch(() => {})
    setPlayingTrackUrl(objectUrl)
  }

  const submit = async () => {
    if (!images.length && !content && !caption) {
      return toast.error("Add text or media before publishing")
    }

    if (mode === "reel" && Number(meta.duration_seconds || 0) > 45) {
      return toast.error("Reel duration must be 45 seconds or less")
    }

    try {
      setLoading(true)
      const formData = new FormData()
      const normalizedContent = content.trim()
      const normalizedCaption = caption.trim()
      const postText = mode === "reel" ? normalizedCaption : normalizedContent
      const postType = mode === "reel" ? "reel" : images.length && postText ? "text_with_image" : images.length ? "image" : "text"
      const customMusicTitle = customMusicFile?.name?.replace(/\.[^/.]+$/, "") || ""
      const selectedMusic = selectedTrack
        ? { title: selectedTrack.title, artist: selectedTrack.artist, url: selectedTrack.url }
        : customMusicFile
          ? { title: customMusicTitle, artist: "Custom track", url: "" }
          : null

      formData.append('content', mode === "reel" ? "" : postText)
      formData.append('caption', mode === "reel" ? postText : (images.length ? postText : ""))
      formData.append('post_type', postType)
      formData.append('is_reel', String(mode === "reel"))
      formData.append('visibility', meta.visibility)
      formData.append('duration_seconds', meta.duration_seconds)
      formData.append('category', meta.category)
      formData.append('sub_category', meta.sub_category)
      formData.append('target_audience', meta.target_audience)
      formData.append('music_title', selectedMusic?.title || "")
      formData.append('music_artist', selectedMusic?.artist || "")
      formData.append('music_url', selectedMusic?.url || "")
      images.forEach((image) => formData.append('images', image))
      if (customMusicFile) {
        formData.append('music_file', customMusicFile)
      }

      const { data } = await api.post('/api/post/add', formData, { headers: { ...authHeaders, "Content-Type": "multipart/form-data" } })
      if (!data.success) throw new Error(data.message)
      toast.success("Content published")
      navigate(mode === "reel" ? "/app/reels" : "/app")
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='px-4 pb-16 pt-8 lg:px-8'>
      <audio ref={audioRef} onEnded={() => setPlayingTrackUrl("")} />

      <div className="mx-auto max-w-5xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/30 sm:p-8">
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">New post</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Share what is new with your audience.</h1>
          </div>
          <div className='flex rounded-2xl bg-slate-100 p-1'>
            {["post", "reel"].map((item) => (
              <button key={item} onClick={() => switchMode(item)} className={`rounded-2xl px-5 py-2.5 text-sm font-medium capitalize ${mode === item ? "bg-slate-950 text-white" : "text-slate-500"}`}>
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className='mt-8 grid gap-8 lg:grid-cols-[1fr_320px]'>
          <div className="space-y-4">
            <div className='flex items-center gap-4'>
              <Avatar src={user?.profile_picture} alt={user?.full_name || "profile"} size="md" />
              <div>
                <h2 className="font-semibold text-slate-900">{user?.full_name}</h2>
                <p className="text-sm text-slate-500">@{user?.username}</p>
              </div>
            </div>

            <textarea className="min-h-40 w-full resize-none rounded-[1.6rem] border border-slate-200 p-4 text-sm outline-none" placeholder={mode === "reel" ? "Write a caption for your reel..." : "What would you like to share today?"} value={mode === "reel" ? caption : content} onChange={(e) => mode === "reel" ? setCaption(e.target.value) : setContent(e.target.value)} />

            {mode === "post" && (
              <label className='flex cursor-pointer items-center justify-center gap-2 rounded-[1.6rem] border border-dashed border-slate-300 p-6 text-slate-600'>
                <Image className='h-5 w-5' />
                Add photos
                <input type="file" accept='image/*' hidden multiple onChange={(e)=> setImages([...images, ...Array.from(e.target.files)])} />
              </label>
            )}

            {mode === "reel" && (
              <div className='space-y-4'>
                <label className='flex cursor-pointer items-center justify-center gap-2 rounded-[1.6rem] border border-dashed border-slate-300 p-6 text-slate-600'>
                  <Film className='h-5 w-5' />
                  Upload reel
                  <input type="file" accept='video/*' hidden onChange={(e)=> handleReelUpload(e.target.files?.[0])} />
                </label>

                <div className='grid gap-3 rounded-[1.8rem] border border-slate-200 bg-slate-50 p-4'>
                  <div>
                    <p className='text-sm font-semibold text-slate-900'>Music</p>
                    <p className='mt-1 text-xs leading-5 text-slate-500'>Choose a track for your reel, preview it first, or upload your own audio.</p>
                  </div>

                  <div className='space-y-3'>
                    {REEL_TRACKS.map((track) => {
                      const isSelected = selectedTrackId === track.id
                      const isPlaying = playingTrackUrl === track.url

                      return (
                        <div
                          key={track.id}
                          className={`flex items-center justify-between gap-3 rounded-[1.3rem] border p-3 transition ${
                            isSelected ? "border-slate-900 bg-slate-950 text-white" : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className='min-w-0'>
                            <p className={`truncate text-sm font-semibold ${isSelected ? "text-white" : "text-slate-900"}`}>{track.title}</p>
                            <p className={`truncate text-xs ${isSelected ? "text-white/65" : "text-slate-500"}`}>{track.artist}</p>
                          </div>

                          <div className='flex items-center gap-2'>
                            <button
                              type='button'
                              onClick={() => togglePreviewTrack(track)}
                              className={`rounded-full p-2 ${isSelected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700"}`}
                            >
                              {isPlaying ? <Pause className='h-4 w-4' /> : <Play className='h-4 w-4' />}
                            </button>
                            <button
                              type='button'
                              onClick={() => {
                                setSelectedTrackId(track.id)
                                setCustomMusicFile(null)
                              }}
                              className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${
                                isSelected ? "bg-lime-300 text-slate-950" : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {isSelected ? <Check className='h-4 w-4' /> : null}
                              {isSelected ? "Applied" : "Use"}
                            </button>
                          </div>
                        </div>
                      )
                    })}

                    <label className='rounded-[1.3rem] border border-dashed border-slate-300 bg-white p-4'>
                      <span className='mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500'>
                        <Upload className='h-4 w-4' />
                        Upload custom music
                      </span>
                      <div className='flex items-center justify-between gap-3'>
                        <div className='min-w-0'>
                          <p className='truncate text-sm font-semibold text-slate-900'>
                            {customMusicFile ? customMusicFile.name : "Add your own soundtrack"}
                          </p>
                          <p className='text-xs text-slate-500'>You can preview it as soon as you choose it</p>
                        </div>
                        <span className='rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700'>
                          Choose
                        </span>
                      </div>
                      <input
                        type="file"
                        accept='audio/*'
                        hidden
                        onChange={(e) => handleCustomMusicUpload(e.target.files?.[0])}
                      />
                    </label>

                  </div>
                </div>
              </div>
            )}

            {images.length > 0 && (
              <div className='grid gap-3 sm:grid-cols-2'>
                {images.map((image, i)=>(
                  <div key={i} className='relative overflow-hidden rounded-[1.4rem] bg-slate-100'>
                    {image.type?.startsWith("video") ? (
                      <video src={URL.createObjectURL(image)} className='h-52 w-full object-cover' />
                    ) : (
                      <img src={URL.createObjectURL(image)} alt="preview" className='h-52 w-full object-cover' />
                    )}
                    <button onClick={()=> setImages(images.filter((_, index) => index !== i))} className='absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white'>
                      <X className='h-4 w-4' />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {mode === "reel" && (selectedTrack || customMusicFile) && (
              <div className='rounded-[1.8rem] border border-slate-200 bg-slate-50 p-4'>
                <p className='text-sm font-semibold text-slate-900'>Reel preview details</p>
                <div className='mt-3 flex flex-wrap gap-2'>
                  {(selectedTrack || customMusicFile) && (
                    <span className='inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm shadow-sm'>
                      <Music2 className='h-4 w-4 text-slate-500' />
                      {selectedTrack ? `${selectedTrack.title} • ${selectedTrack.artist}` : `${customMusicFile?.name || "Custom track"} • Custom track`}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className='space-y-4 rounded-[1.8rem] bg-slate-50 p-5'>
            <h3 className='text-lg font-semibold text-slate-900'>Audience settings</h3>
            {["category", "sub_category", "target_audience"].map((field) => (
              <input
                key={field}
                placeholder={field === "category" ? "Category" : field === "sub_category" ? "Subcategory" : "Target audience"}
                value={meta[field]}
                onChange={(e) => setMeta({ ...meta, [field]: e.target.value })}
                className='w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none'
              />
            ))}
            <select value={meta.visibility} onChange={(e) => setMeta({ ...meta, visibility: e.target.value })} className='w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none'>
              <option value="public">Public</option>
              <option value="followers">Followers only</option>
              <option value="private">Only me</option>
            </select>
            <button disabled={loading} onClick={submit} className='w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white'>
              {loading ? "Publishing..." : mode === "reel" ? "Publish Reel" : "Publish Post"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreatePost
