import React, { useEffect, useState } from 'react'
import { Bookmark, Heart, MessageCircle, MoreVertical, Send, Verified } from "lucide-react"
import moment from 'moment'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { useAuth } from '../auth/AuthProvider'
import Avatar from './Avatar'

const PostCard = ({post, readOnly = false, onRequireAuth, onDeleted, highlighted = false}) => {
  const [entity, setEntity] = useState(post)
  const [comment, setComment] = useState("")
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [replyDrafts, setReplyDrafts] = useState({})
  const [replyingTo, setReplyingTo] = useState(null)
  const [activeCommentMenu, setActiveCommentMenu] = useState(null)
  const [postMenuOpen, setPostMenuOpen] = useState(false)
  const { authHeaders } = useAuth()
  const currentUser = useSelector((state)=>state.user.value)
  const navigate = useNavigate()

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
      <div key={item._id} className={`rounded-2xl bg-slate-50 p-3 ${depth > 0 ? "ml-4 mt-3 border border-slate-200" : ""}`}>
        <div className='flex items-center justify-between gap-3'>
          <div className='flex items-center gap-3'>
            <Avatar src={item.user?.profile_picture} alt={item.user?.full_name || "BuzzMitra user"} size="xs" />
            <div>
              <p className='text-sm font-semibold text-slate-900'>{item.user?.full_name || "BuzzMitra user"}</p>
              <p className='text-xs text-slate-400'>@{item.user?.username || "user"}</p>
            </div>
          </div>
          <div className='relative flex items-center gap-2'>
            <button onClick={() => callAction('/api/post/comment/like', { postId: entity._id, commentId: item._id })} className='inline-flex items-center gap-1 text-xs text-slate-500'>
              <Heart className={`h-4.5 w-4.5 ${item.isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
              {item.likeCount || 0}
            </button>
            {!readOnly && (String(item.user?._id || "") === String(currentUser?._id || "") || String(entity.user?._id || "") === String(currentUser?._id || "")) && (
              <>
                <button
                  onClick={() => setActiveCommentMenu((prev) => prev === item._id ? null : item._id)}
                  className='rounded-full p-1.5 text-slate-500 transition hover:bg-slate-200'
                >
                  <MoreVertical className='h-4 w-4' />
                </button>
                {activeCommentMenu === item._id && (
                  <div className='absolute right-0 top-8 z-10 min-w-28 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl'>
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
        <p className='mt-2 text-sm text-slate-600'>{item.text}</p>
        <div className='mt-3 flex items-center gap-3 text-xs text-slate-500'>
          <button onClick={() => setReplyingTo(replyingTo === item._id ? null : item._id)}>Reply</button>
        </div>
        {replyingTo === item._id && (
          <div className='mt-3 flex items-center gap-2'>
            <input
              value={replyDrafts[item._id] || ""}
              onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [item._id]: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && submitReply(item._id)}
              placeholder='Write a reply...'
              className='flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none'
            />
            <button onClick={() => submitReply(item._id)} className='rounded-2xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white'>Reply</button>
          </div>
        )}
        {item.replies?.length > 0 && <div className='mt-2'>{renderCommentThread(item.replies, depth + 1)}</div>}
      </div>
    ))

  return (
    <div className={`overflow-hidden rounded-[2rem] border bg-white shadow-xl shadow-slate-200/30 transition ${highlighted ? "border-lime-300 ring-2 ring-lime-200" : "border-slate-200"}`}>
      <div className="flex items-center justify-between px-5 pt-5">
        <div onClick={()=> readOnly ? onRequireAuth?.() : navigate(`/app/profile/${entity.user._id}`)} className="inline-flex items-center gap-3 cursor-pointer">
          <Avatar src={entity.user.profile_picture} alt={entity.user.full_name} size="sm" />
          <div>
            <div className="flex items-center space-x-1">
              <span className='font-semibold text-slate-900'>{entity.user.full_name}</span>
              <Verified className='w-4 h-4 text-cyan-500' />
            </div>
            <div className='text-sm text-slate-500'>
              @{entity.user.username} • {moment(entity.createdAt).fromNow()}
            </div>
          </div>
        </div>
        <div className='relative flex items-center gap-2'>
          <span className='rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500'>{entity.is_reel ? "Reel" : "Post"}</span>
          {!readOnly && String(entity.user?._id || "") === String(currentUser?._id || "") && (
            <>
              <button
                onClick={() => setPostMenuOpen((prev) => !prev)}
                className='rounded-full p-2 text-slate-500 transition hover:bg-slate-100'
              >
                <MoreVertical className='h-4 w-4' />
              </button>
              {postMenuOpen && (
                <div className='absolute right-0 top-11 z-10 min-w-28 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl'>
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
        <div className='px-5 pt-4 text-sm leading-7 text-slate-700 whitespace-pre-line'>
          {entity.caption || entity.content}
        </div>
      )}

      {entity.image_urls?.length > 0 && (
        <div className={`mt-4 grid gap-2 px-5 pb-1 ${entity.image_urls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {entity.image_urls.map((img, index) => (
            <div key={index} className="aspect-[4/3] overflow-hidden rounded-[1.4rem] bg-slate-100">
              <img src={img} alt={`post image ${index + 1}`} className="h-full w-full object-cover"/>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between border-y border-slate-100 px-5 py-2 text-sm text-slate-600">
        <button onClick={() => callAction('/api/post/like', { postId: entity._id })} className='inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2'>
          <Heart className={`h-6 w-6 ${entity.isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
          {`${entity.likeCount ?? 0} likes`}
        </button>
        <button onClick={() => setCommentsOpen((prev) => !prev)} className='inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2'>
          <MessageCircle className='h-6 w-6' />
          {`${entity.commentCount || entity.comments?.length || 0} comments`}
        </button>
        <button onClick={sharePost} className='inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2'>
          <Send className='h-6 w-6' />
          {`${entity.shareCount ?? 0} shares`}
        </button>
        <button onClick={() => callAction('/api/post/save', { postId: entity._id })} className='inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2'>
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
            className='flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none disabled:bg-slate-50 disabled:text-slate-400'
          />
          <button onClick={submitComment} className='rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white'>{readOnly ? 'Join' : 'Post'}</button>
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
