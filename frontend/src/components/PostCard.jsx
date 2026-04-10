import React, { useEffect, useState } from 'react'
import { Bookmark, Heart, MessageCircle, MoreVertical, Send, Verified } from "lucide-react"
import moment from 'moment'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { useAuth } from '../auth/AuthProvider'
import Avatar from './Avatar'
import { useThemeSettings } from '../theme/ThemeProvider'
import clsx from 'clsx'

const PostCard = ({post, readOnly = false, onRequireAuth, onDeleted, highlighted = false}) => {
  const [entity, setEntity] = useState(post)
  const [comment, setComment] = useState("")
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [replyDrafts, setReplyDrafts] = useState({})
  const [replyingTo, setReplyingTo] = useState(null)
  const [activeCommentMenu, setActiveCommentMenu] = useState(null)
  const [postMenuOpen, setPostMenuOpen] = useState(false)
  const { authHeaders } = useAuth()
  const { theme } = useThemeSettings()
  const currentUser = useSelector((state)=>state.user.value)
  const navigate = useNavigate()
  const isDark = theme === "dark"

  useEffect(() => {
    setEntity(post)
  }, [post])

  const callAction = async (url, payload) => {
    if (readOnly) {
      onRequireAuth?.()
      toast("Create an account to interact with posts")
      return
    }
    try {
      const { data } = await api.post(url, payload, { headers: authHeaders })
      if (data.success) {
        if (data.post) setEntity(data.post)
        if (data.message) toast.success(data.message)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
  }

  const submitComment = async () => {
    if (readOnly) {
      onRequireAuth?.()
      toast("Create an account to comment")
      return
    }
    if (!comment.trim()) return
    await callAction('/api/post/comment', { postId: entity._id, text: comment })
    setComment("")
    setCommentsOpen(true)
  }

  const submitReply = async (commentId) => {
    const text = replyDrafts[commentId]?.trim()
    if (!text) return
    await callAction('/api/post/comment/reply', { postId: entity._id, commentId, text })
    setReplyDrafts((prev) => ({ ...prev, [commentId]: "" }))
    setReplyingTo(null)
    setCommentsOpen(true)
  }

  const deleteComment = async (commentId) => {
    await callAction('/api/post/comment/delete', { postId: entity._id, commentId })
    setActiveCommentMenu(null)
  }

  const deletePost = async () => {
    if (readOnly) {
      onRequireAuth?.()
      return
    }
    try {
      const { data } = await api.post('/api/post/delete', { postId: entity._id }, { headers: authHeaders })
      if (!data.success) throw new Error(data.message)
      toast.success(data.message || "Post deleted")
      onDeleted?.(entity._id)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setPostMenuOpen(false)
    }
  }

  const sharePost = async () => {
    if (readOnly) {
      onRequireAuth?.()
      toast("Create an account to share posts")
      return
    }

    const shareUrl = `${window.location.origin}/app?post=${entity._id}`

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${entity.user?.full_name || "BuzzMitra"} on BuzzMitra`,
          text: entity.caption || entity.content || "Check out this post on BuzzMitra",
          url: shareUrl,
        })
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
      } else {
        throw new Error("Sharing is not available on this device")
      }

      await callAction('/api/post/share', { postId: entity._id })
      if (!navigator.share) {
        toast.success("Post link copied")
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast.error(error.message)
      }
    }
  }

  const renderCommentThread = (items = [], depth = 0) =>
    items.map((item) => (
      <div key={item._id} className={clsx(`rounded-2xl p-3 ${depth > 0 ? "ml-4 mt-3 border" : ""}`, isDark ? "bg-white/6 border-white/10" : "bg-slate-50 border-slate-200")}>
        <div className='flex items-center justify-between gap-3'>
          <div className='flex items-center gap-3'>
            <Avatar src={item.user?.profile_picture} alt={item.user?.full_name || "BuzzMitra user"} size="xs" />
            <div>
              <p className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-slate-900')}>{item.user?.full_name || "BuzzMitra user"}</p>
              <p className={clsx('text-xs', isDark ? 'text-white/45' : 'text-slate-400')}>@{item.user?.username || "user"}</p>
            </div>
          </div>
          <div className='relative flex items-center gap-2'>
            <button onClick={() => callAction('/api/post/comment/like', { postId: entity._id, commentId: item._id })} className={clsx('inline-flex items-center gap-1 text-xs', isDark ? 'text-white/58' : 'text-slate-500')}>
              <Heart className={`h-4.5 w-4.5 ${item.isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
              {item.likeCount || 0}
            </button>
            {!readOnly && (String(item.user?._id || "") === String(currentUser?._id || "") || String(entity.user?._id || "") === String(currentUser?._id || "")) && (
              <>
                <button
                  onClick={() => setActiveCommentMenu((prev) => prev === item._id ? null : item._id)}
                  className={clsx('rounded-full p-1.5 transition', isDark ? 'text-white/60 hover:bg-white/8' : 'text-slate-500 hover:bg-slate-200')}
                >
                  <MoreVertical className='h-4 w-4' />
                </button>
                {activeCommentMenu === item._id && (
                  <div className={clsx('absolute right-0 top-8 z-10 min-w-28 rounded-2xl border p-1.5 shadow-xl', isDark ? 'border-white/10 bg-black' : 'border-slate-200 bg-white')}>
                    <button
                      onClick={() => deleteComment(item._id)}
                      className='w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-rose-500 transition hover:bg-rose-50'
                    >
                      Delete
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <p className={clsx('mt-2 text-sm', isDark ? 'text-white/78' : 'text-slate-600')}>{item.text}</p>
        <div className={clsx('mt-3 flex items-center gap-3 text-xs', isDark ? 'text-white/52' : 'text-slate-500')}>
          <button onClick={() => setReplyingTo(replyingTo === item._id ? null : item._id)}>Reply</button>
        </div>
        {replyingTo === item._id && (
          <div className='mt-3 flex items-center gap-2'>
            <input
              value={replyDrafts[item._id] || ""}
              onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [item._id]: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && submitReply(item._id)}
              placeholder='Write a reply...'
              className={clsx('flex-1 rounded-2xl border px-3 py-2 text-sm outline-none', isDark ? 'border-white/10 bg-black text-white placeholder:text-white/35' : 'border-slate-200 bg-white text-slate-800')}
            />
            <button onClick={() => submitReply(item._id)} className={clsx('rounded-2xl px-3 py-2 text-xs font-semibold', isDark ? 'bg-white text-black' : 'bg-slate-950 text-white')}>Reply</button>
          </div>
        )}
        {item.replies?.length > 0 && <div className='mt-2'>{renderCommentThread(item.replies, depth + 1)}</div>}
      </div>
    ))

  return (
    <div className={clsx(`overflow-hidden rounded-[2rem] border transition ${highlighted ? "border-lime-300 ring-2 ring-lime-200" : ""}`, isDark ? 'bg-black border-white/10 text-white shadow-xl shadow-black/30' : `bg-white shadow-xl shadow-slate-200/30 ${highlighted ? "" : "border-slate-200"}`)}>
      <div className="flex items-center justify-between px-5 pt-5">
        <div onClick={()=> readOnly ? onRequireAuth?.() : navigate(`/app/profile/${entity.user._id}`)} className="inline-flex items-center gap-3 cursor-pointer">
          <Avatar src={entity.user.profile_picture} alt={entity.user.full_name} size="sm" />
          <div>
            <div className="flex items-center space-x-1">
              <span className={clsx('font-semibold', isDark ? 'text-white' : 'text-slate-900')}>{entity.user.full_name}</span>
              <Verified className='w-4 h-4 text-cyan-500' />
            </div>
            <div className={clsx('text-sm', isDark ? 'text-white/45' : 'text-slate-500')}>
              @{entity.user.username} • {moment(entity.createdAt).fromNow()}
            </div>
          </div>
        </div>
        <div className='relative flex items-center gap-2'>
          <span className={clsx('rounded-full px-3 py-1 text-xs font-medium', isDark ? 'bg-white/8 text-white/68' : 'bg-slate-100 text-slate-500')}>{entity.is_reel ? "Reel" : "Post"}</span>
          {!readOnly && String(entity.user?._id || "") === String(currentUser?._id || "") && (
            <>
              <button
                onClick={() => setPostMenuOpen((prev) => !prev)}
                className={clsx('rounded-full p-2 transition', isDark ? 'text-white/58 hover:bg-white/8' : 'text-slate-500 hover:bg-slate-100')}
              >
                <MoreVertical className='h-4 w-4' />
              </button>
              {postMenuOpen && (
                <div className={clsx('absolute right-0 top-11 z-10 min-w-28 rounded-2xl border p-1.5 shadow-xl', isDark ? 'border-white/10 bg-black' : 'border-slate-200 bg-white')}>
                  <button
                    onClick={deletePost}
                    className='w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-rose-500 transition hover:bg-rose-50'
                  >
                    Delete
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {(entity.caption || entity.content) && (
        <div className={clsx('px-5 pt-4 text-sm leading-7 whitespace-pre-line', isDark ? 'text-white/84' : 'text-slate-700')}>
          {entity.caption || entity.content}
        </div>
      )}

      {entity.image_urls?.length > 0 && (
        <div className={`mt-4 grid gap-2 px-5 pb-1 ${entity.image_urls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {entity.image_urls.map((img, index) => (
            <div key={index} className={clsx("aspect-[4/3] overflow-hidden rounded-[1.4rem]", isDark ? "bg-white/6" : "bg-slate-100")}>
              <img src={img} alt={`post image ${index + 1}`} className="h-full w-full object-cover"/>
            </div>
          ))}
        </div>
      )}

      <div className={clsx("mt-2 flex items-center justify-between border-y px-5 py-2 text-sm", isDark ? "border-white/10 text-white/72" : "border-slate-100 text-slate-600")}>
        <button onClick={() => callAction('/api/post/like', { postId: entity._id })} className={clsx('inline-flex items-center gap-2 rounded-full px-4 py-2', isDark ? 'bg-white/8' : 'bg-slate-100')}>
          <Heart className={`h-6 w-6 ${entity.isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
          {`${entity.likeCount ?? 0} likes`}
        </button>
        <button onClick={() => setCommentsOpen((prev) => !prev)} className={clsx('inline-flex items-center gap-2 rounded-full px-4 py-2', isDark ? 'bg-white/8' : 'bg-slate-100')}>
          <MessageCircle className='h-6 w-6' />
          {`${entity.commentCount || entity.comments?.length || 0} comments`}
        </button>
        <button onClick={sharePost} className={clsx('inline-flex items-center gap-2 rounded-full px-4 py-2', isDark ? 'bg-white/8' : 'bg-slate-100')}>
          <Send className='h-6 w-6' />
          {`${entity.shareCount ?? 0} shares`}
        </button>
        <button onClick={() => callAction('/api/post/save', { postId: entity._id })} className={clsx('inline-flex items-center gap-2 rounded-full px-4 py-2', isDark ? 'bg-white/8' : 'bg-slate-100')}>
          <Bookmark className={`h-6 w-6 ${entity.isSaved ? 'fill-slate-900 text-slate-900' : ''}`} />
          Save
        </button>
      </div>

      <div className="px-5 py-4">
        <div className='flex items-center gap-3'>
          <Avatar src={currentUser?.profile_picture} alt="You" size="sm" />
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onFocus={() => readOnly && onRequireAuth?.()}
            onKeyDown={(e) => e.key === "Enter" && submitComment()}
            placeholder={readOnly ? 'Create an account to comment...' : 'Write a comment...'}
            disabled={readOnly}
            className={clsx('flex-1 rounded-2xl border px-4 py-3 text-sm outline-none', isDark ? 'border-white/10 bg-white/5 text-white placeholder:text-white/35 disabled:bg-white/4 disabled:text-white/30' : 'border-slate-200 disabled:bg-slate-50 text-slate-800')}
          />
          <button onClick={submitComment} className={clsx('rounded-2xl px-4 py-3 text-sm font-semibold', isDark ? 'bg-white text-black' : 'bg-slate-950 text-white')}>{readOnly ? 'Join' : 'Post'}</button>
        </div>

        {commentsOpen && (
          <div className='mt-4 space-y-3'>
            {renderCommentThread((entity.comments || []).slice().reverse())}
          </div>
        )}
      </div>
    </div>
  )
}

export default PostCard
