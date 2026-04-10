import { Link, useLocation } from "react-router-dom";
import clsx from "clsx";
import { useThemeSettings } from "../theme/ThemeProvider";

const PublicShell = ({ title, subtitle, active = "feed", children }) => {
  const location = useLocation();
  const next = `${location.pathname}${location.search || ""}`;
  const { theme } = useThemeSettings();
  const isLight = theme === "light";
  const isDark = theme === "dark";

  return (
    <div className={clsx("min-h-screen transition-colors duration-300", isLight ? "bg-[#f3f7ff] text-slate-900" : isDark ? "bg-black text-white" : "bg-[#07111f] text-white")}>
      <div className={clsx("absolute inset-0", isLight
        ? "bg-[radial-gradient(circle_at_top_left,_rgba(163,230,53,0.16),_transparent_22%),radial-gradient(circle_at_80%_10%,_rgba(34,211,238,0.14),_transparent_18%),linear-gradient(180deg,_rgba(14,165,233,0.08),_transparent_30%)]"
        : isDark
          ? "bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.08),_transparent_18%),linear-gradient(180deg,_rgba(255,255,255,0.02),_transparent_28%)]"
          : "bg-[radial-gradient(circle_at_top_left,_rgba(163,230,53,0.16),_transparent_22%),radial-gradient(circle_at_80%_10%,_rgba(34,211,238,0.16),_transparent_18%),linear-gradient(180deg,_rgba(236,72,153,0.08),_transparent_30%)]")} />
      <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-6 lg:px-8">
        <div className={clsx("mb-8 flex flex-col gap-4 rounded-[2rem] border p-5 backdrop-blur lg:flex-row lg:items-center lg:justify-between", isLight ? "border-slate-200 bg-white/85" : isDark ? "border-white/10 bg-black/80" : "border-white/10 bg-white/[0.06]")}>
          <div>
            <p className={clsx("text-sm uppercase tracking-[0.24em]", isLight ? "text-cyan-600" : isDark ? "text-white/60" : "text-lime-300")}>Explore BuzzMitra</p>
            <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
            <p className={clsx("mt-2 max-w-2xl text-sm", isLight ? "text-slate-600" : isDark ? "text-white/72" : "text-slate-300")}>{subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/"
              className={clsx("rounded-2xl px-4 py-3 text-sm font-medium transition", active === "feed"
                ? "bg-white text-slate-950 shadow-sm"
                : (isLight ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" : isDark ? "border border-white/10 bg-white/6 text-white hover:bg-white/10" : "border border-white/10 bg-white/5"))}
            >
              Feed
            </Link>
            <Link
              to="/public-reels"
              className={clsx("rounded-2xl px-4 py-3 text-sm font-medium transition", active === "reels"
                ? "bg-white text-slate-950 shadow-sm"
                : (isLight ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" : isDark ? "border border-white/10 bg-white/6 text-white hover:bg-white/10" : "border border-white/10 bg-white/5"))}
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
