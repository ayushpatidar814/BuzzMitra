import { ArrowLeft, ImagePlus, Sparkles, SwatchBook, Type, Video } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../auth/AuthProvider';

const STORY_BACKGROUNDS = [
  { solid: '#0f172a', accent: 'from-lime-300/30 via-cyan-300/20 to-fuchsia-400/20' },
  { solid: '#0f766e', accent: 'from-cyan-200/30 via-emerald-200/20 to-teal-400/20' },
  { solid: '#4338ca', accent: 'from-indigo-200/35 via-fuchsia-200/20 to-violet-500/25' },
  { solid: '#db2777', accent: 'from-pink-200/35 via-rose-200/20 to-fuchsia-500/25' },
  { solid: '#f97316', accent: 'from-amber-200/35 via-orange-200/20 to-rose-400/25' },
];

const StoryModel = ({ setShowModel, fetchStories }) => {
  const [mode, setMode] = useState('text');
  const [background, setBackground] = useState(STORY_BACKGROUNDS[0].solid);
  const [text, setText] = useState('');
  const [media, setMedia] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const { authHeaders } = useAuth();

  const MAX_VIDEO_DURATION = 45;

  const activeBackground = useMemo(
    () => STORY_BACKGROUNDS.find((item) => item.solid === background) || STORY_BACKGROUNDS[0],
    [background]
  );

  const resetToText = () => {
    setMode('text');
    setMedia(null);
    setPreviewUrl(null);
  };

  const handleMediaUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('video')) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        if (video.duration > MAX_VIDEO_DURATION) {
          toast.error('Story video cannot exceed 45 seconds.');
        } else {
          setMedia(file);
          setPreviewUrl(URL.createObjectURL(file));
          setText('');
          setMode('media');
        }
      };
      video.src = URL.createObjectURL(file);
      return;
    }

    setMedia(file);
    setPreviewUrl(URL.createObjectURL(file));
    setText('');
    setMode('media');
  };

  const handleCreateStory = async () => {
    const media_type = mode === 'media' ? (media?.type.startsWith('image') ? 'image' : 'video') : 'text';
    if (media_type === 'text' && !text.trim()) {
      throw new Error('Please enter some text');
    }

    const formData = new FormData();
    formData.append('content', text.trim());
    formData.append('media_type', media_type);
    if (media) formData.append('media', media);
    formData.append('background_color', background);
    formData.append('duration_ms', media_type === 'video' ? 45000 : 8000);

    const { data } = await api.post('/api/story/create', formData, {
      headers: { ...authHeaders, 'Content-Type': 'multipart/form-data' },
    });

    if (data.success) {
      setShowModel(false);
      toast.success('Story created successfully');
      fetchStories();
    } else {
      throw new Error(data.message);
    }
  };

  return (
    <div className='fixed inset-0 z-[110] overflow-y-auto bg-[#040712]/90 px-4 py-6 text-white backdrop-blur-xl'>
      <div className='mx-auto w-full max-w-6xl'>
        <div className='rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,.95),rgba(17,24,39,.92))] shadow-2xl shadow-black/40'>
          <div className='flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-8'>
            <button onClick={() => setShowModel(false)} className='inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10'>
              <ArrowLeft className='h-4 w-4' />
              Back
            </button>
            <div className='text-center'>
              <p className='text-xs uppercase tracking-[0.24em] text-lime-300'>Story Studio</p>
              <h2 className='mt-1 text-lg font-semibold sm:text-2xl'>Create a story people stop to watch.</h2>
            </div>
            <button
              className='inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-lime-300 via-cyan-300 to-fuchsia-300 px-4 py-2 font-semibold text-slate-950'
              onClick={() => toast.promise(handleCreateStory(), { loading: 'Creating story...' })}
            >
              <Sparkles className='h-4 w-4' />
              Publish
            </button>
          </div>

          <div className='grid gap-8 p-5 sm:p-8 lg:grid-cols-[320px_minmax(0,1fr)]'>
            <div className='space-y-5'>
              <div className='rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-4'>
                <p className='text-xs uppercase tracking-[0.22em] text-slate-400'>Story Type</p>
                <div className='mt-4 grid gap-3'>
                  <button
                    onClick={resetToText}
                    className={`rounded-[1.4rem] border px-4 py-4 text-left transition ${mode === 'text' ? 'border-lime-300/60 bg-lime-300/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}
                  >
                    <span className='inline-flex items-center gap-2 text-sm font-semibold'>
                      <Type className='h-4 w-4' />
                      Text Story
                    </span>
                    <p className='mt-2 text-xs text-slate-400'>Share a quick thought with bold type and color.</p>
                  </button>

                  <label className={`cursor-pointer rounded-[1.4rem] border px-4 py-4 text-left transition ${mode === 'media' ? 'border-cyan-300/60 bg-cyan-300/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}>
                    <input onChange={handleMediaUpload} type='file' accept='image/*, video/*' className='hidden' />
                    <span className='inline-flex items-center gap-2 text-sm font-semibold'>
                      <ImagePlus className='h-4 w-4' />
                      Photo or Video
                    </span>
                    <p className='mt-2 text-xs text-slate-400'>Upload a moment from your camera roll. Videos up to 45 seconds.</p>
                  </label>
                </div>
              </div>

              <div className='rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-4'>
                <p className='inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-400'>
                  <SwatchBook className='h-4 w-4' />
                  Palette
                </p>
                <div className='mt-4 grid grid-cols-5 gap-3'>
                  {STORY_BACKGROUNDS.map((item) => (
                    <button
                      key={item.solid}
                      onClick={() => setBackground(item.solid)}
                      className={`h-12 rounded-2xl border-2 transition ${background === item.solid ? 'border-white scale-105' : 'border-white/10'}`}
                      style={{ background: item.solid }}
                    />
                  ))}
                </div>
                <p className='mt-3 text-xs text-slate-500'>Choose the mood for your story background.</p>
              </div>

              {mode === 'text' ? (
                <div className='rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-4'>
                  <p className='text-xs uppercase tracking-[0.22em] text-slate-400'>Caption</p>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder='Share a thought, update, or moment...'
                    className='mt-4 min-h-40 w-full resize-none rounded-[1.4rem] border border-white/10 bg-slate-950/50 p-4 text-sm text-white outline-none placeholder:text-slate-500'
                  />
                </div>
              ) : (
                <div className='rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-4'>
                  <p className='inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-400'>
                    {media?.type?.startsWith('video') ? <Video className='h-4 w-4' /> : <ImagePlus className='h-4 w-4' />}
                    Media Story
                  </p>
                  <p className='mt-4 text-sm text-slate-300'>
                    {media ? `${media.name} selected` : 'Upload a photo or video to preview it here.'}
                  </p>
                  <button onClick={resetToText} className='mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10'>
                    Switch to text
                  </button>
                </div>
              )}
            </div>

            <div className='flex flex-col items-center justify-center rounded-[1.8rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(163,230,53,.14),transparent_22%),linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.02))] p-5'>
              <div className='mb-5 text-center'>
                <p className='text-xs uppercase tracking-[0.24em] text-slate-400'>Live Preview</p>
                <h3 className='mt-2 text-xl font-semibold'>Preview how your story will look.</h3>
              </div>

              <div className={`relative w-full max-w-[22rem] rounded-[2.5rem] border border-white/10 bg-gradient-to-br ${activeBackground.accent} p-3 shadow-[0_25px_80px_rgba(0,0,0,.45)]`}>
                <div className='rounded-[2.1rem] bg-[#060b16] p-3'>
                  <div
                    className='relative flex h-[34rem] overflow-hidden rounded-[1.8rem] border border-white/10'
                    style={{ backgroundColor: background }}
                  >
                    {mode === 'text' ? (
                      <>
                        <div className='absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,.12),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,.08),transparent_26%)]' />
                        <div className='relative flex h-full w-full items-center justify-center p-8'>
                          <p className='max-w-xs text-center text-3xl font-semibold leading-tight text-white drop-shadow-[0_6px_20px_rgba(0,0,0,.35)]'>
                            {text || 'Your next story starts here.'}
                          </p>
                        </div>
                      </>
                    ) : previewUrl ? (
                      media?.type?.startsWith('image') ? (
                        <img src={previewUrl} alt='Story Preview' className='h-full w-full object-cover' />
                      ) : (
                        <video src={previewUrl} className='h-full w-full object-cover' controls />
                      )
                    ) : (
                      <div className='flex h-full w-full items-center justify-center text-center text-sm text-slate-300'>
                        Upload media to see your story preview.
                      </div>
                    )}

                    <div className='absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/45 to-transparent p-4'>
                      <div className='flex items-center gap-3'>
                        <div className='h-10 w-10 rounded-2xl border border-white/25 bg-white/10' />
                        <div>
                          <p className='text-sm font-semibold text-white'>@you</p>
                          <p className='text-xs text-white/70'>Just now</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <p className='mt-5 max-w-md text-center text-sm text-slate-400'>
                Stories disappear after 24 hours, so keep them quick, clear, and worth tapping through.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoryModel;
