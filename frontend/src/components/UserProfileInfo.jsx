import { Calendar, MapPin, MessageCircle, PenBox, Sparkles, UserPlus, Verified } from 'lucide-react'
import moment from 'moment'
import React from 'react'
import Avatar from './Avatar'

const UserProfileInfo = ({
  user,
  posts,
  reels = [],
  stats,
  isOwnProfile,
  isFollowing,
  canMessage,
  followLoading,
  messageLoading,
  setShowEdit,
  onOpenFollowers,
  onOpenFollowing,
  onToggleFollow,
  onMessage,
}) => {
  const totalPosts = stats?.totalContentCount ?? ((posts?.length || 0) + (reels?.length || 0))
  const followersCount = user.followers_count ?? user.followers?.length ?? 0
  const followingCount = user.following_count ?? user.following?.length ?? 0
  const joinedLabel = user.createdAt ? moment(user.createdAt).format('MMMM YYYY') : 'Recently'
  const profileChips = [
    user.role && user.role !== 'user' ? user.role : null,
    user.account_visibility === 'public' ? 'Public profile' : 'Private profile',
    user.location || null,
  ].filter(Boolean)

  return (
    <div className="relative overflow-hidden rounded-[2.2rem] border border-white/10 bg-[linear-gradient(140deg,rgba(15,23,42,.97),rgba(17,24,39,.92))] px-6 pb-6 pt-8 text-white shadow-[0_25px_80px_rgba(15,23,42,.35)] md:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(163,230,53,.18),transparent_24%),radial-gradient(circle_at_80%_18%,rgba(34,211,238,.16),transparent_22%),linear-gradient(180deg,rgba(244,114,182,.08),transparent_35%)]" />
      <div className="relative">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-5 md:flex-row md:items-end">
            <Avatar src={user.profile_picture} alt={user.full_name} size="profile" className="border border-white/15 bg-white/10 shadow-2xl shadow-black/30" />

            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-lime-200/80">
                <Sparkles className="h-3.5 w-3.5" />
                Profile
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{user.full_name}</h1>
                <div className="inline-flex items-center gap-1 rounded-full bg-cyan-400/15 px-3 py-1 text-sm text-cyan-100">
                  <Verified className="h-4 w-4 text-cyan-300" />
                  Active creator
                </div>
              </div>

              <p className="mt-2 text-base text-slate-300">{user.username ? `@${user.username}` : 'Add a username'}</p>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">{user.bio || 'Add a short bio so people know who you are and what you share here.'}</p>

              <div className="mt-5 flex flex-wrap gap-2">
                {profileChips.map((chip) => (
                  <span key={chip} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200">
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isOwnProfile ? (
              <button
                onClick={() => setShowEdit(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-95"
              >
                <PenBox className="h-4 w-4" />
                Edit profile
              </button>
            ) : (
              <>
                <button
                  onClick={onToggleFollow}
                  disabled={followLoading}
                  className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                    isFollowing
                      ? "border border-white/20 bg-white/5 text-white hover:bg-white/10"
                      : "bg-lime-300 text-slate-950 hover:brightness-95"
                  } disabled:opacity-60`}
                >
                  <UserPlus className="h-4 w-4" />
                  {followLoading ? "Updating..." : isFollowing ? "Following" : "Follow"}
                </button>
                <button
                  onClick={onMessage}
                  disabled={messageLoading || !canMessage}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <MessageCircle className="h-4 w-4" />
                  {messageLoading ? "Opening..." : "Message"}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,.8fr)]">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex h-full flex-col justify-center rounded-[1.7rem] border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Content</p>
              <p className="mt-3 text-3xl font-semibold">{totalPosts}</p>
              <p className="mt-1 text-sm text-slate-300">Posts and reels published</p>
            </div>

            <button onClick={onOpenFollowers} className="flex h-full flex-col justify-center rounded-[1.7rem] border border-white/10 bg-white/[0.06] p-5 text-left backdrop-blur">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Followers</p>
              <p className="mt-3 text-3xl font-semibold">{followersCount}</p>
              <p className="mt-1 text-sm text-slate-300">People following your updates</p>
            </button>

            <button onClick={onOpenFollowing} className="flex h-full flex-col justify-center rounded-[1.7rem] border border-white/10 bg-white/[0.06] p-5 text-left backdrop-blur">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Following</p>
              <p className="mt-3 text-3xl font-semibold">{followingCount}</p>
              <p className="mt-1 text-sm text-slate-300">People you chose to follow</p>
            </button>
          </div>

          <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">About</p>
            <div className="mt-4 space-y-4 text-sm text-slate-200">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                  <MapPin className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Location</p>
                  <p>{user.location || 'Location not added yet'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                  <Calendar className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Joined</p>
                  <p>{joinedLabel}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-slate-300">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Profile mood</span>
                <p className="mt-2 leading-6">
                  {user.bio
                    ? 'Keep your profile active with fresh posts, reels, and a bio that reflects what you are sharing right now.'
                    : 'Add a bio, location, and profile photo to help people recognize you and connect faster.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserProfileInfo
