import { useAuth } from '@clerk/clerk-react';
import { ArrowLeft, Sparkle, TextIcon, Upload} from 'lucide-react';
import React from 'react'
import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';

const StoryModel = ({setShowModel, fetchStories}) => {

    const bgColors = ["#4f46e5", "#7c3aed", "#ec4899", "#f59e0b", "#10b981"]

    const [mode, setMode] = useState("text")
    const [background, setBackground] = useState(bgColors[0])
    const [text, setText] = useState("")
    const [media, setMedia] = useState(null)
    const [previewUrl, setPreviewUrl] = useState(null)

    const { getToken } = useAuth()

    const MAX_VIDEO_DURATION = 60; //seconds
    const MAX_VIDEO_SIZE_MB = 50; //MB

    const handleMediaUpload = (e) => {
        const file = e.target.files?.[0]
        if (file) {
            if(file.type.startsWith("video")){
                if(file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024){
                    toast.error(`Video file size cannot exceed ${MAX_VIDEO_SIZE_MB} MB.`)
                    setMedia(null)
                    setPreviewUrl(null)
                    return;
                }
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.onloadedmetadata = ()=>{
                    window.URL.revokeObjectURL(video.src)
                    if(video.duration > MAX_VIDEO_DURATION){
                        toast.error('Video duration cannot exceed 1 minute.')
                        setMedia(null)
                        setPreviewUrl(null)
                    } else{
                        setMedia(file)
                        setPreviewUrl(URL.createObjectURL(file))
                        setText('')
                        setMode('media')            
                    }
                }
                video.src = URL.createObjectURL(file)
            } else if(file.type.startsWith('image')){
                setMedia(file)
                setPreviewUrl(URL.createObjectURL(file))
                setText('')
                setMode('media')            
            }
        }
    }

    const handleCreateStory = async (e) => {
        const media_type = mode === 'media' ? media?.type.startsWith('image') ? 'image' : 'video' : 'text';

        if(media_type === 'text' && !text){
            throw new Error('Please enter some text')
        }

        let formData = new FormData();
        formData.append('content', text);
        formData.append('media_type', media_type);
        formData.append('media', media);
        formData.append('background_color', background);

        try {
            const { data } = await api.post('/api/story/create', formData, {
                headers: {Authorization: `Bearer ${await getToken()}`}
            })
            if(data.success){
                setShowModel(false)
                toast.success('Story created successfully')
                fetchStories()
            } else{
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

  return (
    <div className='fixed inset-0 min-h-screen bg-black/80 z-110 flex items-center justify-center p-4 backdrop-blur text-white'>
        <div className="w-full max-w-md">
            <div className="text-center mb-4 flex items-center justify-between">
                <button onClick={()=> setShowModel(false)} className="text-white p-2 cursor-pointe">
                    <ArrowLeft />
                </button>
                <h2 className="text-lg font-semibold">Create Story</h2>
                <span className='w-10'></span>
            </div>

            <div className='rounded-lg h-96 flex items-center justify-center relative' style={{backgroundColor: background}}>
                {
                    mode === "text" && (
                        <textarea 
                            value={text} 
                            onChange={(e) => setText(e.target.value)} 
                            placeholder='Write your story here...' 
                            className='w-full h-full p-6 bg-transparent text-white focus:outline-none resize-none text-lg'
                        />
                    )} 
                    { mode === "media" && previewUrl && (
                        media?.type.startsWith('image') ? (
                           <img src={previewUrl} alt="Story Preview" className='max-h-full object-contain' />
                        ) : (
                            <video src={previewUrl} alt='Story Preview' className='object-contain max-h-full' />    
                        )
                    )
                }

            </div>

            <div className='flex mt-4 gap-2'>
                {bgColors.map((color) => (
                    <button key={color} className='w-6 h-6 rounded-full ring cursor-pointer' style={{backgroundColor: color}} onClick={()=> setBackground(color)} />
                ))}
            </div>

            <div className="flex gap-2 mt-4">
                <button 
                    onClick={() => {setMode("text"); setMedia(null); setPreviewUrl(null)}} 
                    className={`flex-1 p-2 flex items-center justify-center gap-2 rounded-lg cursor-pointer ${mode === "text" ? 'bg-white text-black' : 'bg-zinc-800'}`}
                >
                    <TextIcon size={18} />Text
                </button>
                <label className={`flex-1 flex items-center justify-center gap-2 p-2 rounded cursor-pointer ${mode === 'media' ? "bg-white text-black" : "bg-zinc-800"} `}>
                    <input onChange={handleMediaUpload} type="file" accept='image/*, video/*' className='hidden' />
                    <Upload size={18} />Photo/Video
                </label>
            </div>
            <button  className="flex items-center justify-center gap-2 w-full bg-indigo-600 text-white p-2 rounded-lg mt-4 hover:bg-indigo-700 active:scale-95 transition-all duration-200" 
            onClick={()=> toast.promise(handleCreateStory(), {
                loading: "Creating Story...",
            })}>
                <Sparkle size={18} /> Create Story
            </button>
        </div>
    </div>
  )
}

export default StoryModel