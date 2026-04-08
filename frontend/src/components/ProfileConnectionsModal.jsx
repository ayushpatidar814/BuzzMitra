import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Avatar from './Avatar'

const ProfileConnectionsModal = ({ title, users = [], onClose }) => {
  const navigate = useNavigate()

  return (
    <div className='fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm'>
      <div className='w-full max-w-2xl overflow-hidden rounded-[2rem] bg-white shadow-2xl'>
        <div className='flex items-center justify-between border-b border-slate-100 px-6 py-5'>
          <div>
            <h2 className='text-xl font-semibold text-slate-900'>{title}</h2>
            <p className='mt-1 text-sm text-slate-500'>{users.length} people</p>
          </div>
          <button onClick={onClose} className='rounded-full p-2 text-slate-500 hover:bg-slate-100'>
            <X className='h-5 w-5' />
          </button>
        </div>

        <div className='max-h-[70vh] overflow-y-auto p-4'>
          {users.length > 0 ? users.map((person) => (
            <button
              key={person._id}
              onClick={() => {
                onClose()
                navigate(`/app/profile/${person._id}`)
              }}
              className='flex w-full items-center gap-4 rounded-2xl px-4 py-3 text-left transition hover:bg-slate-50'
            >
              <Avatar src={person.profile_picture} alt={person.full_name} size="sm" />
              <div className='min-w-0 flex-1'>
                <p className='truncate font-medium text-slate-900'>{person.full_name}</p>
                <p className='truncate text-sm text-slate-500'>@{person.username || 'user'}</p>
                <p className='mt-1 truncate text-xs text-slate-400'>{person.bio || 'BuzzMitra user'}</p>
              </div>
            </button>
          )) : (
            <div className='rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500'>
              No users to show yet.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProfileConnectionsModal
