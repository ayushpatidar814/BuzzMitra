import { Loader2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Avatar from './Avatar'
import VirtualList from './VirtualList'

const ProfileConnectionsModal = ({ title, users = [], onClose, hasMore = false, loading = false, onLoadMore }) => {
  const navigate = useNavigate()

  return (
    <div className='fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm'>
      <div className='w-full max-w-2xl overflow-hidden no-scrollbar rounded-[2rem] bg-white shadow-2xl'>
        <div className='flex items-center justify-between border-b border-slate-100 px-6 py-5'>
          <div>
            <h2 className='text-xl font-semibold text-slate-900'>{title}</h2>
            <p className='mt-1 text-sm text-slate-500'>{users.length} people</p>
          </div>
          <button onClick={onClose} className='rounded-full p-2 text-slate-500 hover:bg-slate-100'>
            <X className='h-5 w-5' />
          </button>
        </div>

        <div className='p-4'>
          {users.length > 0 ? (
            <VirtualList
              items={users}
              itemHeight={96}
              height={Math.min(560, Math.max(180, users.length * 96))}
              className='overflow-y-auto no-scrollbar'
              renderItem={(person) => (
                <button
                  key={person._id}
                  onClick={() => {
                    onClose()
                    navigate(`/app/profile/${person._id}`)
                  }}
                  className='flex h-24 w-full items-center gap-4 rounded-2xl px-4 py-3 text-left transition hover:bg-slate-50'
                >
                  <Avatar src={person.profile_picture} alt={person.full_name} size="sm" />
                  <div className='min-w-0 flex-1'>
                    <p className='truncate font-medium text-slate-900'>{person.full_name}</p>
                    <p className='truncate text-sm text-slate-500'>@{person.username || 'user'}</p>
                    <p className='mt-1 truncate text-xs text-slate-400'>{person.bio || 'BuzzMitra user'}</p>
                  </div>
                </button>
              )}
            />
          ) : (
            <div className='rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500'>
              No users to show yet.
            </div>
          )}
          {hasMore && (
            <div className='mt-4 flex justify-center'>
              <button
                onClick={onLoadMore}
                disabled={loading}
                className='inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 disabled:opacity-60'
              >
                {loading && <Loader2 className='h-4 w-4 animate-spin' />}
                {loading ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProfileConnectionsModal
