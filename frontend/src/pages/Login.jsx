import React, { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Film, MessageCircleMore, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../auth/AuthProvider'
import { useLocation, useNavigate } from 'react-router-dom'

const Login = () => {
  const { login, register, startOAuth, isAuthenticated } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mode, setMode] = useState("login")
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    full_name: "",
    username: "",
    email: "",
    password: "",
  })
  const nextPath = useMemo(() => new URLSearchParams(location.search).get("next") || "/app", [location.search])
  const oauthStatus = useMemo(() => new URLSearchParams(location.search).get("oauth"), [location.search])

  useEffect(() => {
    if (isAuthenticated) {
      navigate(nextPath, { replace: true })
    }
  }, [isAuthenticated, navigate, nextPath])

  useEffect(() => {
    if (!oauthStatus) return

    const messages = {
      "missing-email": "This social account did not provide an email address.",
      "missing-code": "The sign-in request was interrupted. Please try again.",
      "unsupported-provider": "That sign-in provider is not available.",
      "Google login is not configured yet": "Google sign-in is not configured yet.",
      "Facebook login is not configured yet": "Facebook sign-in is not configured yet.",
    }

    toast.error(messages[oauthStatus] || "Social sign-in could not be completed.")
    navigate(`/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`, { replace: true })
  }, [navigate, nextPath, oauthStatus])

  const submit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      if (mode === "login") {
        await login({ email: form.email, password: form.password })
      } else {
        await register(form)
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#07111f] text-white overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(163,230,53,0.22),_transparent_22%),radial-gradient(circle_at_80%_15%,_rgba(34,211,238,0.18),_transparent_20%),linear-gradient(180deg,_rgba(236,72,153,0.08),_transparent_30%)]" />
      <div className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-lime-200">
            <Sparkles className="h-4 w-4" /> Join the conversation
          </p>
          <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[1.02] sm:text-6xl">
            Stay close to your people, share what matters, and discover new voices every day.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-slate-300">
            BuzzMitra brings together messaging, stories, reels, and posts in one social space that feels fast on both mobile and desktop.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { icon: MessageCircleMore, title: "Private chats", copy: "Send quick updates, replies, media, and stay in sync across conversations." },
              { icon: Film, title: "Reels that move", copy: "Watch short videos, swipe through creators, and find new content fast." },
              { icon: Sparkles, title: "Profiles and stories", copy: "Share moments, follow people you care about, and keep your page up to date." },
            ].map((item) => (
              <div key={item.title} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <item.icon className="h-5 w-5 text-lime-300" />
                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{item.copy}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.08] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
          <div className="flex rounded-2xl bg-slate-900/70 p-1">
            {["login", "register"].map((item) => (
              <button
                key={item}
                onClick={() => setMode(item)}
                className={`flex-1 rounded-2xl px-4 py-3 text-sm font-medium capitalize transition ${
                  mode === item ? "bg-white text-slate-950" : "text-slate-300"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "register" && (
              <>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 outline-none placeholder:text-slate-500"
                  placeholder="Full name"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
                <input
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 outline-none placeholder:text-slate-500"
                  placeholder="Username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </>
            )}
            <input
              type="email"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 outline-none placeholder:text-slate-500"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              type="password"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 outline-none placeholder:text-slate-500"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />

            <button
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-lime-300 via-cyan-300 to-fuchsia-300 px-4 py-3 font-semibold text-slate-950 transition hover:brightness-105"
            >
              {loading ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.24em] text-slate-500">
            <div className="h-px flex-1 bg-white/10" />
            Or continue with
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button onClick={() => startOAuth("google", nextPath)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium hover:bg-white/10">
              Google
            </button>
            <button onClick={() => startOAuth("facebook", nextPath)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium hover:bg-white/10">
              Facebook
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
