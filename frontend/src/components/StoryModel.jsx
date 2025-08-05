import { ArrowLeft, Sparkle, TextIcon, Upload} from 'lucide-react';
import React from 'react'
import { useState } from 'react';
import toast from 'react-hot-toast';

const StoryModel = ({setShowModel, fetchStories}) => {

    const bgColors = ["#4f46e5", "#7c3aed", "#ec4899", "#f59e0b", "#10b981"]

    const [mode, setMode] = useState("text")
    const [background, setBackground] = useState(bgColors[0])
    const [text, setText] = useState("")
    const [media, setMedia] = useState(null)
    const [previewUrl, setPreviewUrl] = useState(null)

    const handleMediaUpload = (e) => {
        const file = e.target.files[0]
        if (file) {
            setMedia(file)
            setPreviewUrl(URL.createObjectURL(file))
        }
    }

    const handleCreateStory = async (e) => {
    
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
                    <input onChange={(e) => {handleMediaUpload(e); setMode('media')}} type="file" accept='image/*, video/*' className='hidden' />
                    <Upload size={18} />Photo/Video
                </label>
            </div>
            <button  className="flex items-center justify-center gap-2 w-full bg-indigo-600 text-white p-2 rounded-lg mt-4 hover:bg-indigo-700 active:scale-95 transition-all duration-200" 
            onClick={()=> toast.promise(handleCreateStory(), {
                loading: "Creating Story...",
                success: <p>Story Added</p>,
                error: e=> <p>{e.message}</p>,
            })}>
                <Sparkle size={18} />Create Story
            </button>
        </div>
    </div>
  )
}

export default StoryModel