import { Link, useLocation } from "react-router-dom";

const PublicShell = ({ title, subtitle, active = "feed", children }) => {
  const location = useLocation();
  const next = `${location.pathname}${location.search || ""}`;

  return (
    <div className="min-h-screen bg-[#07111f] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(163,230,53,0.16),_transparent_22%),radial-gradient(circle_at_80%_10%,_rgba(34,211,238,0.16),_transparent_18%),linear-gradient(180deg,_rgba(236,72,153,0.08),_transparent_30%)]" />
      <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-lime-300">Explore BuzzMitra</p>
            <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">{subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/"
              className={`rounded-2xl px-4 py-3 text-sm font-medium ${active === "feed" ? "bg-white text-slate-950" : "border border-white/10 bg-white/5"}`}
            >
              Feed
            </Link>
            <Link
              to="/public-reels"
              className={`rounded-2xl px-4 py-3 text-sm font-medium ${active === "reels" ? "bg-white text-slate-950" : "border border-white/10 bg-white/5"}`}
            >
              Reels
            </Link>
            <Link to={`/login?next=${encodeURIComponent(next)}`} className="rounded-2xl bg-gradient-to-r from-lime-300 via-cyan-300 to-fuchsia-300 px-4 py-3 text-sm font-semibold text-slate-950">
              Join now
            </Link>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
};

export default PublicShell;
