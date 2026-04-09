import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { Clapperboard, Grid2X2, Images, Sparkles } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Loading from '../components/Loading'
import UserProfileInfo from '../components/UserProfileInfo'
import PostCard from '../components/PostCard'
import moment from 'moment'
import toast from 'react-hot-toast'
import { useDispatch, useSelector } from 'react-redux'
import api from '../api/axios'
import { useAuth } from '../auth/AuthProvider'
import { fetchConnections } from '../features/connections/connectionsSlice'
import { fetchUser as refreshCurrentUser } from '../features/user/userSlice'

const ProfileConnectionsModal = lazy(() => import('../components/ProfileConnectionsModal'))
const ProfileModel = lazy(() => import('../components/ProfileModel'))

const tabMeta = {
  posts: {
    label: 'Posts',
    Icon: Grid2X2,
    title: 'Recent posts',
    copy: 'Updates, conversations, and moments shared on this profile.',
  },
  media: {
    label: 'Media',
    Icon: Images,
    title: 'Photos and media',
    copy: 'A gallery of images shared here.',
  },
  reels: {
    label: 'Reels',
    Icon: Clapperboard,
    title: 'Reels',
    copy: 'Short videos shared on this profile.',
  },
}

const Profile = () => {
  const currentUser = useSelector((state) => state.user.value)
  const { authHeaders, token } = useAuth()
  const { profileId } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [user, setUser] = useState(null)
  const [posts, setPosts] = useState([])
  const [reels, setReels] = useState([])
  const [followers, setFollowers] = useState([])
  const [following, setFollowing] = useState([])
  const [postsCursor, setPostsCursor] = useState(null)
  const [reelsCursor, setReelsCursor] = useState(null)
  const [postsHasMore, setPostsHasMore] = useState(false)
  const [reelsHasMore, setReelsHasMore] = useState(false)
  const [loadingMorePosts, setLoadingMorePosts] = useState(false)
  const [loadingMoreReels, setLoadingMoreReels] = useState(false)
  const [connectionsState, setConnectionsState] = useState({
    followers: { items: [], cursor: null, hasMore: false, loading: false },
    following: { items: [], cursor: null, hasMore: false, loading: false },
  })
  const [stats, setStats] = useState({ postCount: 0, reelCount: 0, totalContentCount: 0, mediaCount: 0 })
  const [activeTab, setActiveTab] = useState('posts')
  const [showEdit, setShowEdit] = useState(false)
  const [connectionsModal, setConnectionsModal] = useState(null)
  const [followLoading, setFollowLoading] = useState(false)
  const [messageLoading, setMessageLoading] = useState(false)

  const fetchUser = useCallback(async (targetProfileId) => {
    try {
      const { data } = await api.post('/api/user/profiles', { profileId: targetProfileId }, {
        headers: authHeaders,
      })
      if (data.success) {
        setUser(data.profile)
        setPosts(data.posts)
        setReels(data.reels || [])
        setFollowers(data.followersPreview || data.followers || [])
        setFollowing(data.followingPreview || data.following || [])
        setPostsHasMore(Boolean(data.postsHasMore))
        setReelsHasMore(Boolean(data.reelsHasMore))
        setPostsCursor(data.postsNextCursor || null)
        setReelsCursor(data.reelsNextCursor || null)
        setConnectionsState({
          followers: { items: data.followersPreview || data.followers || [], cursor: null, hasMore: (data.profile?.followers_count || 0) > (data.followersPreview || data.followers || []).length, loading: false },
          following: { items: data.followingPreview || data.following || [], cursor: null, hasMore: (data.profile?.following_count || 0) > (data.followingPreview || data.following || []).length, loading: false },
        })
        setStats(
          data.stats || {
            postCount: data.posts?.length || 0,
            reelCount: data.reels?.length || 0,
            totalContentCount: (data.posts?.length || 0) + (data.reels?.length || 0),
            mediaCount: (data.posts || []).filter((post) => (post.image_urls || []).length > 0 || post.media_type === 'image').length,
          }
        )
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
  }, [authHeaders])

  useEffect(() => {
    if (profileId) {
      fetchUser(profileId)
    } else if (currentUser?._id) {
      fetchUser(currentUser._id)
    }
  }, [profileId, currentUser?._id, fetchUser])

  const targetProfileId = profileId || currentUser?._id

  const fetchMoreContent = useCallback(async (type) => {
    if (!targetProfileId) return
    const isReels = type === 'reels'
    const cursor = isReels ? reelsCursor : postsCursor
    const hasMore = isReels ? reelsHasMore : postsHasMore
    if (!cursor || !hasMore) return

    try {
      isReels ? setLoadingMoreReels(true) : setLoadingMorePosts(true)
      const { data } = await api.getDedup(`/api/user/profiles/${targetProfileId}/content`, {
        headers: authHeaders,
        params: { type, cursor },
      })
      if (!data.success) throw new Error(data.message)
      if (isReels) {
        setReels((prev) => [...prev, ...(data.items || [])])
        setReelsHasMore(Boolean(data.hasMore))
        setReelsCursor(data.nextCursor || null)
      } else {
        setPosts((prev) => [...prev, ...(data.items || [])])
        setPostsHasMore(Boolean(data.hasMore))
        setPostsCursor(data.nextCursor || null)
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      isReels ? setLoadingMoreReels(false) : setLoadingMorePosts(false)
    }
  }, [authHeaders, postsCursor, postsHasMore, reelsCursor, reelsHasMore, targetProfileId])

  const fetchMoreConnections = useCallback(async (type) => {
    if (!targetProfileId) return
    const currentState = connectionsState[type]
    const nextCursor = currentState.cursor
    setConnectionsState((prev) => ({
      ...prev,
      [type]: { ...prev[type], loading: true },
    }))

    try {
      const { data } = await api.getDedup(`/api/user/profiles/${targetProfileId}/connections`, {
        headers: authHeaders,
        params: {
          type,
          ...(nextCursor ? { cursor: nextCursor } : {}),
        },
      })
      if (!data.success) throw new Error(data.message)
      setConnectionsState((prev) => ({
        ...prev,
        [type]: {
          items: nextCursor ? [...prev[type].items, ...(data.users || [])] : (data.users || []),
          cursor: data.nextCursor || null,
          hasMore: Boolean(data.hasMore),
          loading: false,
        },
      }))
      if (type === 'followers') setFollowers((prev) => (nextCursor ? [...prev, ...(data.users || [])] : (data.users || [])))
      else setFollowing((prev) => (nextCursor ? [...prev, ...(data.users || [])] : (data.users || [])))
    } catch (error) {
      toast.error(error.message)
      setConnectionsState((prev) => ({
        ...prev,
        [type]: { ...prev[type], loading: false },
      }))
    }
  }, [authHeaders, connectionsState, targetProfileId])

  useEffect(() => {
    if (!connectionsModal) return
    if (!connectionsState[connectionsModal].items.length) {
      fetchMoreConnections(connectionsModal)
    }
  }, [connectionsModal, connectionsState, fetchMoreConnections])

  useEffect(() => {
    const handleFocus = () => {
      if (profileId) fetchUser(profileId)
      else if (currentUser?._id) fetchUser(currentUser._id)
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [profileId, currentUser?._id, fetchUser])

  const mediaPosts = useMemo(
    () => posts.filter((post) => (post.image_urls || []).length > 0 || post.media_type === 'image'),
    [posts]
  )

  if (!user) return <Loading />

  const currentTabMeta = tabMeta[activeTab]
  const isOwnProfile = !profileId || String(currentUser?._id || "") === String(user?._id || "")
  const isFollowing = followers.some((item) => String(item._id) === String(currentUser?._id))
  const canMessage = isFollowing || following.some((item) => String(item._id) === String(currentUser?._id))

  const handleToggleFollow = async () => {
    try {
      setFollowLoading(true)
      const endpoint = isFollowing ? '/api/user/unfollow' : '/api/user/follow'
      const { data } = await api.post(endpoint, { id: user._id }, { headers: authHeaders })
      if (!data.success) throw new Error(data.message)
      toast.success(data.message)
      if (token) {
        dispatch(refreshCurrentUser(token))
        dispatch(fetchConnections(token))
      }
      fetchUser(user._id)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setFollowLoading(false)
    }
  }

  const handleMessage = async () => {
    if (!canMessage) {
      toast.error("Follow each other first to start chatting")
      return
    }
    try {
      setMessageLoading(true)
      const { data } = await api.post('/api/chat/chat', { receiverId: user._id }, { headers: authHeaders })
      if (!data.success) throw new Error(data.message)
      navigate(`/app/messages/${data.data._id}`)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setMessageLoading(false)
    }
  }

  return (
    <div className='min-h-full bg-[radial-gradient(circle_at_top,_rgba(163,230,53,.12),_transparent_20%),linear-gradient(180deg,_#0f172a_0%,_#111827_20%,_#e2e8f0_20%,_#f8fafc_100%)] px-4 pb-14 pt-8 lg:px-8'>
      <div className='mx-auto max-w-6xl'>
        <div className='rounded-[2.4rem] border border-white/10 bg-white/5 p-2 backdrop-blur-md shadow-[0_24px_70px_rgba(15,23,42,.18)]'>
          <div className='overflow-hidden rounded-[2rem]'>
            <div className='relative h-64 bg-[linear-gradient(120deg,#bef264_0%,#22d3ee_35%,#f472b6_100%)] md:h-80'>
              {user.cover_photo && <img src={user.cover_photo} alt='cover_photo' className='h-full w-full object-cover' />}
              <div className='absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,.1),rgba(15,23,42,.58))]' />
              <div className='absolute inset-x-0 bottom-0 flex items-end justify-between px-6 pb-6 text-white md:px-8'>
                <div>
                  <p className='text-xs uppercase tracking-[0.24em] text-white/70'>Profile</p>
                  <h2 className='mt-2 text-2xl font-semibold md:text-3xl'>
                    {profileId ? `${user.full_name}'s profile` : 'Your profile'}
                  </h2>
                </div>
                <div className='hidden rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-right backdrop-blur md:block'>
                  <p className='text-xs uppercase tracking-[0.2em] text-white/60'>Updated</p>
                  <p className='mt-1 text-sm font-medium'>{moment(user.updatedAt || user.createdAt).fromNow()}</p>
                </div>
              </div>
            </div>

            <UserProfileInfo
              user={user}
              posts={posts}
              reels={reels}
              stats={stats}
              profileId={profileId}
              isOwnProfile={isOwnProfile}
              isFollowing={isFollowing}
              canMessage={canMessage}
              followLoading={followLoading}
              messageLoading={messageLoading}
              setShowEdit={setShowEdit}
              onOpenFollowers={() => setConnectionsModal('followers')}
              onOpenFollowing={() => setConnectionsModal('following')}
              onToggleFollow={handleToggleFollow}
              onMessage={handleMessage}
            />
          </div>
        </div>

        <div className='mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]'>
          <div>
            <div className='rounded-[2rem] border border-slate-200/70 bg-white/90 p-4 shadow-xl shadow-slate-200/40'>
              <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
                <div>
                  <p className='text-xs uppercase tracking-[0.22em] text-slate-400'>Content</p>
                  <h3 className='mt-2 text-2xl font-semibold text-slate-900'>{currentTabMeta.title}</h3>
                  <p className='mt-1 text-sm text-slate-500'>{currentTabMeta.copy}</p>
                </div>
                <div className='inline-flex flex-wrap gap-2 rounded-[1.4rem] bg-slate-100 p-1.5'>
                  {Object.entries(tabMeta).map(([key, tab]) => (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className={`inline-flex items-center gap-2 rounded-[1rem] px-4 py-2.5 text-sm font-medium transition ${
                        activeTab === key ? 'bg-slate-950 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      <tab.Icon className='h-4 w-4' />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {activeTab === 'posts' && (
              <div className='mt-6 flex flex-col items-center gap-6'>
                {posts.length > 0 ? posts.map((post) => (
                  <div key={post._id} className='w-full max-w-2xl'>
                    <PostCard post={post} />
                  </div>
                )) : (
                  <div className='w-full rounded-[2rem] border border-dashed border-slate-300 bg-white/70 px-8 py-16 text-center text-slate-500'>
                    No posts yet.
                  </div>
                )}
                {postsHasMore && (
                  <button
                    onClick={() => fetchMoreContent('posts')}
                    disabled={loadingMorePosts}
                    className='rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 disabled:opacity-60'
                  >
                    {loadingMorePosts ? 'Loading...' : 'Load more posts'}
                  </button>
                )}
              </div>
            )}

            {activeTab === 'media' && (
              <div className='mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
                {mediaPosts.length > 0 ? mediaPosts.flatMap((post) =>
                  (post.image_urls || []).map((image, index) => (
                    <Link target='_blank' to={image} key={`${post._id}-${index}`} className='group overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white p-2 shadow-lg shadow-slate-200/40'>
                      <div className='relative overflow-hidden rounded-[1.3rem] bg-slate-100'>
                        <img src={image} className='aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-105' alt='image' />
                        <div className='absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 to-transparent px-4 py-3 text-xs text-white opacity-0 transition group-hover:opacity-100'>
                          Posted {moment(post.createdAt).fromNow()}
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className='rounded-[2rem] border border-dashed border-slate-300 bg-white/70 px-8 py-16 text-center text-slate-500 sm:col-span-2 xl:col-span-3'>
                    No photos or media yet.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reels' && (
              <div className='mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3'>
                {reels.length > 0 ? reels.map((reel) => (
                  <article key={reel._id} className='overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 text-white shadow-2xl shadow-slate-950/30'>
                    <video src={reel.media_url} className='aspect-[9/16] w-full object-cover' controls preload="metadata" />
                    <div className='p-4'>
                      <p className='line-clamp-3 text-sm leading-6 text-slate-200'>{reel.caption || reel.content || 'Reel'}</p>
                    </div>
                  </article>
                )) : (
                  <div className='rounded-[2rem] border border-dashed border-slate-300 bg-white/70 px-8 py-16 text-center text-slate-500 sm:col-span-2 xl:col-span-3'>
                    No reels yet.
                  </div>
                )}
                {reelsHasMore && (
                  <button
                    onClick={() => fetchMoreContent('reels')}
                    disabled={loadingMoreReels}
                    className='sm:col-span-2 xl:col-span-3 justify-self-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 disabled:opacity-60'
                  >
                    {loadingMoreReels ? 'Loading...' : 'Load more reels'}
                  </button>
                )}
              </div>
            )}
          </div>

          <aside className='space-y-4 xl:sticky xl:top-8 xl:self-start'>
            <div className='rounded-[2rem] border border-white/10 bg-slate-950/95 p-5 text-white shadow-2xl shadow-slate-950/30'>
              <p className='text-xs uppercase tracking-[0.22em] text-lime-300'>Profile tips</p>
              <h3 className='mt-3 text-xl font-semibold'>A complete profile helps people connect faster.</h3>
              <p className='mt-2 text-sm leading-6 text-slate-300'>
                Keep your photo, bio, and recent content updated so visitors immediately understand who you are and what you share.
              </p>
            </div>

            <div className='rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/40'>
              <p className='inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-400'>
                <Sparkles className='h-4 w-4' />
                Highlights
              </p>
              <div className='mt-4 space-y-4'>
                <div className='rounded-2xl bg-slate-50 px-4 py-4'>
                  <p className='text-xs uppercase tracking-[0.18em] text-slate-400'>Media posts</p>
                  <p className='mt-2 text-2xl font-semibold text-slate-900'>{stats.mediaCount || 0}</p>
                </div>
                <div className='rounded-2xl bg-slate-50 px-4 py-4'>
                  <p className='text-xs uppercase tracking-[0.18em] text-slate-400'>Reels shared</p>
                  <p className='mt-2 text-2xl font-semibold text-slate-900'>{stats.reelCount || 0}</p>
                </div>
                <div className='rounded-2xl bg-slate-50 px-4 py-4'>
                  <p className='text-xs uppercase tracking-[0.18em] text-slate-400'>Joined</p>
                  <p className='mt-2 text-lg font-semibold text-slate-900'>{moment(user.createdAt).format('DD MMM YYYY')}</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {showEdit && (
        <Suspense fallback={null}>
          <ProfileModel setShowEdit={setShowEdit} />
        </Suspense>
      )}
      {connectionsModal && (
        <Suspense fallback={null}>
          <ProfileConnectionsModal
            title={connectionsModal === 'followers' ? 'Followers' : 'Following'}
            users={connectionsState[connectionsModal].items}
            hasMore={connectionsState[connectionsModal].hasMore}
            loading={connectionsState[connectionsModal].loading}
            onLoadMore={() => fetchMoreConnections(connectionsModal)}
            onClose={() => setConnectionsModal(null)}
          />
        </Suspense>
      )}
    </div>
  )
}

export default Profile
