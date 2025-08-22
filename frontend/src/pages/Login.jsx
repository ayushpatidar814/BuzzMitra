import React from 'react'
import { Star } from 'lucide-react'
import { SignIn } from '@clerk/clerk-react'


const Login = () => {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Background Image */}
      <img src='./bgImage.png' alt="logo" className='absolute top-0 left-0 -z-1 w-full h-full object-cover' />

      {/* left-side */}
      <div className="flex-1 flex flex-col items-start justify-between p-6 md:p-10 lg:pl-40">
        <img src='./logo-transparent.png' alt="logo" className='h-44 object-contain' />
        <div
          <div className="flex items-center gap-3 mb-4 max-md:mt-10">
            <img src='./group_users.png' alt="group image" className='h-8 md:h-10' />
            <div>
              <div className="flex">
                {Array(5).fill(0).map((_, i) => (<Star key={i} className="size-4 md:size-4.5 text-transparent fill-amber-500" /> ))}
              </div>      
              <p className="text-sm md:text-base text-indigo-900">
                Trusted by <span className="font-semibold">123k+ users worldwide</span>
              </p>
            </div>
          </div>

          <h1 className="text-3xl md:text-6xl md:pb-2 font-extrabold bg-gradient-to-r from-indigo-900 via-indigo-700 to-purple-600 bg-clip-text text-transparent leading-tight">
            Where Connections Become Friendships
          </h1>

          <p className="text-lg md:text-2xl text-indigo-800 max-w-72 md:max-w-lg mt-2">
            Join <span className="font-semibold">BuzzMitra</span> — the place to share, discover, and grow with a global community.
          </p>

          <p className="text-base md:text-xl text-indigo-700 mt-3 italic">
            Because every buzz matters. 🐝
          </p>
        </div>
        <span className="md:h-10"></span>
      </div>

      {/* right-side */}
       <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
          <SignIn />
       </div>
    </div>
  )
}

export default Login
