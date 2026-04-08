import React, { useMemo, useState } from 'react'
import { Camera, MapPin, Pencil, Sparkles, X } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import { updateUser } from '../features/user/userSlice'
import toast from 'react-hot-toast'
import { useAuth } from '../auth/AuthProvider'
import Avatar from './Avatar'

const ProfileModel = ({ setShowEdit }) => {
  const dispatch = useDispatch()
  const { getToken } = useAuth()
  const user = useSelector((state) => state.user.value)
  const [editForm, setEditForm] = useState({
    username: user.username,
    bio: user.bio,
    location: user.location,
    profile_picture: null,
    cover_photo: null,
    full_name: user.full_name,
  })

  const previewProfile = useMemo(
    () => (editForm.profile_picture ? URL.createObjectURL(editForm.profile_picture) : user.profile_picture),
    [editForm.profile_picture, user.profile_picture]
  )
  const previewCover = useMemo(
    () => (editForm.cover_photo ? URL.createObjectURL(editForm.cover_photo) : user.cover_photo),
    [editForm.cover_photo, user.cover_photo]
  )

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    try {
      const userData = new FormData()
      const { full_name, username, bio, location, profile_picture, cover_photo } = editForm
      userData.append('username', username)
      userData.append('bio', bio)
      userData.append('location', location)
      userData.append('full_name', full_name)
      profile_picture && userData.append('profile', profile_picture)
      cover_photo && userData.append('cover', cover_photo)

      const token = await getToken()
      await dispatch(updateUser({ userData, token })).unwrap()
      setShowEdit(false)
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <div className='fixed inset-0 z-[130] overflow-y-auto bg-[#020617]/80 px-4 py-6 text-white backdrop-blur-xl'>
      <div className='mx-auto max-w-5xl'>
        <div className='overflow-hidden rounded-[2.4rem] border border-white/10 bg-[linear-gradient(140deg,rgba(15,23,42,.98),rgba(17,24,39,.94))] shadow-[0_32px_120px_rgba(2,6,23,.55)]'>
          <div className='border-b border-white/10 px-6 py-5 md:px-8'>
            <div className='flex flex-wrap items-start justify-between gap-4'>
              <div>
                <p className='inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-lime-200/80'>
                  <Sparkles className='h-3.5 w-3.5' />
                  Profile Editor
                </p>
                <h1 className='mt-4 text-3xl font-semibold tracking-tight'>Remix your profile vibe</h1>
                <p className='mt-2 max-w-2xl text-sm leading-6 text-slate-300'>
                  Refresh your look, sharpen your bio, and make sure your page hits with the right energy.
                </p>
              </div>
              <button onClick={() => setShowEdit(false)} className='rounded-full border border-white/10 bg-white/5 p-3 text-slate-300 transition hover:bg-white/10'>
                <X className='h-5 w-5' />
              </button>
            </div>
          </div>

          <form onSubmit={(e) => toast.promise(handleSaveProfile(e), { loading: 'Saving profile...' })} className='grid gap-8 p-6 md:p-8 lg:grid-cols-[1.05fr_.95fr]'>
            <div className='space-y-5'>
              <div className='overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04]'>
                <div className='relative h-56 bg-[linear-gradient(120deg,#bef264_0%,#22d3ee_35%,#f472b6_100%)]'>
                  {previewCover ? (
                    <img src={previewCover} alt='cover preview' className='h-full w-full object-cover' />
                  ) : null}
                  <div className='absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,.08),rgba(15,23,42,.58))]' />
                  <label className='absolute right-4 top-4 inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-black/25 px-4 py-2 text-sm font-medium text-white backdrop-blur'>
                    <Camera className='h-4 w-4' />
                    Cover photo
                    <input
                      hidden
                      type='file'
                      accept='image/*'
                      onChange={(e) => setEditForm({ ...editForm, cover_photo: e.target.files?.[0] || null })}
                    />
                  </label>
                  <div className='absolute inset-x-0 bottom-0 flex items-end gap-4 px-5 pb-5'>
                    <div className='group/profile relative'>
                      <label htmlFor='profile_picture' className='cursor-pointer'>
                        <Avatar src={previewProfile} alt='profile preview' size='profile' className='border border-white/15 bg-white/10 shadow-2xl shadow-black/30' />
                        <span className='absolute inset-0 hidden items-center justify-center rounded-[1.5rem] bg-black/25 group-hover/profile:flex'>
                          <Pencil className='h-5 w-5 text-white' />
                        </span>
                      </label>
                      <input
                        hidden
                        id='profile_picture'
                        type='file'
                        accept='image/*'
                        onChange={(e) => setEditForm({ ...editForm, profile_picture: e.target.files?.[0] || null })}
                      />
                    </div>

                    <div className='pb-2 text-white'>
                      <p className='text-sm uppercase tracking-[0.2em] text-white/65'>Live preview</p>
                      <h2 className='mt-2 text-2xl font-semibold'>{editForm.full_name || 'Your name'}</h2>
                      <p className='mt-1 text-sm text-white/75'>@{editForm.username || 'username'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className='rounded-[2rem] border border-white/10 bg-white/[0.04] p-5'>
                <div className='grid gap-5'>
                  <div>
                    <label className='mb-2 block text-sm font-medium text-slate-200'>Display name</label>
                    <input
                      type='text'
                      className='w-full rounded-[1.2rem] border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500'
                      placeholder='Your full name'
                      onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                      value={editForm.full_name}
                    />
                  </div>

                  <div>
                    <label className='mb-2 block text-sm font-medium text-slate-200'>Username</label>
                    <input
                      type='text'
                      className='w-full rounded-[1.2rem] border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500'
                      placeholder='Choose a username'
                      onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                      value={editForm.username}
                    />
                  </div>

                  <div>
                    <label className='mb-2 block text-sm font-medium text-slate-200'>Bio</label>
                    <textarea
                      rows={5}
                      className='w-full resize-none rounded-[1.2rem] border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500'
                      placeholder='Write a short bio people will see on your profile.'
                      onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                      value={editForm.bio}
                    />
                  </div>

                  <div>
                    <label className='mb-2 block text-sm font-medium text-slate-200'>Location</label>
                    <div className='flex items-center gap-3 rounded-[1.2rem] border border-white/10 bg-slate-950/40 px-4 py-3'>
                      <MapPin className='h-4 w-4 text-slate-400' />
                      <input
                        type='text'
                        className='w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500'
                        placeholder='City, country, or region'
                        onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                        value={editForm.location}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className='space-y-5'>
              <div className='rounded-[2rem] border border-white/10 bg-white/[0.04] p-5'>
                <p className='text-xs uppercase tracking-[0.22em] text-slate-400'>Profile energy</p>
                <div className='mt-4 space-y-4'>
                  <div className='rounded-[1.4rem] border border-white/10 bg-slate-950/35 p-4'>
                    <p className='text-sm font-medium text-white'>First impression</p>
                    <p className='mt-2 text-sm leading-6 text-slate-300'>
                      A sharp profile photo plus a clear bio makes your page feel more alive and easier to trust.
                    </p>
                  </div>
                  <div className='rounded-[1.4rem] border border-white/10 bg-slate-950/35 p-4'>
                    <p className='text-sm font-medium text-white'>Bio tip</p>
                    <p className='mt-2 text-sm leading-6 text-slate-300'>
                      Keep it short, specific, and personal. One line about what you do and one line about what you are into works well.
                    </p>
                  </div>
                  <div className='rounded-[1.4rem] border border-white/10 bg-slate-950/35 p-4'>
                    <p className='text-sm font-medium text-white'>Visual feel</p>
                    <p className='mt-2 text-sm leading-6 text-slate-300'>
                      Portrait profile photos with stronger contrast and a clean cover image usually look best across feed, chat, and stories.
                    </p>
                  </div>
                </div>
              </div>

              <div className='rounded-[2rem] border border-white/10 bg-white/[0.04] p-5'>
                <p className='text-xs uppercase tracking-[0.22em] text-slate-400'>Preview copy</p>
                <div className='mt-4 rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-4'>
                  <p className='text-lg font-semibold text-white'>{editForm.full_name || 'Your name'}</p>
                  <p className='mt-1 text-sm text-slate-400'>@{editForm.username || 'username'}</p>
                  <p className='mt-4 text-sm leading-7 text-slate-300'>
                    {editForm.bio || 'Your updated bio will show up here once you add something personal.'}
                  </p>
                  <p className='mt-4 text-sm text-slate-400'>
                    {editForm.location || 'Add a location to make your profile feel more grounded.'}
                  </p>
                </div>
              </div>

              <div className='flex flex-wrap justify-end gap-3 pt-2'>
                <button
                  onClick={() => setShowEdit(false)}
                  type='button'
                  className='rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10'
                >
                  Cancel
                </button>

                <button
                  type='submit'
                  className='rounded-2xl bg-gradient-to-r from-lime-300 via-cyan-300 to-fuchsia-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-105'
                >
                  Save changes
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ProfileModel
