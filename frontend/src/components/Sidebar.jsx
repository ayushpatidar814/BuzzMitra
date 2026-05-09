import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Home,
  MessageCircle,
  UserIcon,
  Users,
  CirclePlus,
  LogOut,
  Clapperboard,
  BellRing,
  Settings2,
} from "lucide-react";
import { useSelector } from "react-redux";
import { selectTotalUnread } from "../features/messagesWS/chatSelectors";
import { useAuth } from "../auth/AuthProvider";
import Avatar from "./Avatar";
import clsx from "clsx";
import { useThemeSettings } from "../theme/ThemeProvider";

const menuItems = [
  { to: "/app", label: "Feed", Icon: Home },
  { to: "/app/reels", label: "Reels", Icon: Clapperboard },
  { to: "/app/messages", label: "Messages", Icon: MessageCircle },
  { to: "/app/notifications", label: "Notifications", Icon: BellRing },
  { to: "/app/connections", label: "People", Icon: Users },
  { to: "/app/profile", label: "Profile", Icon: UserIcon },
  { to: "/app/settings", label: "Settings", Icon: Settings2 },
];

const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { theme } = useThemeSettings();
  const user = useSelector((state) => state.user.value);
  const unreadChats = useSelector(selectTotalUnread);
  const unreadNotifications = useSelector((state) => state.notifications.unreadCount);
  const isLight = theme === "light";
  const isDark = theme === "dark";

  return (
    <div
      className={clsx(`z-20 flex h-[100dvh] w-[17rem] shrink-0 self-start flex-col justify-between overflow-y-auto border-r backdrop-blur-xl sm:w-72 max-sm:fixed max-sm:inset-y-0 lg:fixed lg:left-0 lg:top-0
      ${sidebarOpen ? "translate-x-0" : "max-sm:-translate-x-full"}
      transition-all duration-300 ease-in-out`, isLight ? "bg-white/92 text-slate-900 border-slate-200/80 shadow-xl shadow-slate-200/40" : isDark ? "bg-black/95 text-white border-white/10 shadow-2xl shadow-black/40" : "bg-slate-950/92 text-white border-white/10")}
    >
      <div className="w-full">
        <img onClick={() => navigate("/app")} src="/newLogo.png" alt="logo" className="ml-5 my-3 w-24 cursor-pointer sm:ml-6 sm:w-28" />

        <div className={clsx("mx-4 mb-5 rounded-3xl border p-4 sm:mx-6 sm:mb-6", isLight ? "border-cyan-100 bg-gradient-to-br from-lime-50 via-cyan-50 to-fuchsia-50" : isDark ? "border-white/10 bg-gradient-to-br from-white/7 via-white/4 to-transparent" : "border-lime-300/20 bg-gradient-to-br from-lime-300/10 via-cyan-400/5 to-fuchsia-400/10")}>
          <p className={clsx("text-xs uppercase tracking-[0.28em]", isLight ? "text-cyan-700" : isDark ? "text-white/55" : "text-lime-200/70")}>Today on BuzzMitra</p>
          <h2 className={clsx("mt-2 text-xm font-semibold leading-tight", isLight ? "text-slate-900" : "text-white")}>Catch up on people you follow, jump into chats, and discover what is trending.</h2>
        </div>

        <div className="space-y-2 px-3 sm:px-4">
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/app"}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                clsx("relative flex items-center gap-3 px-4 py-2 rounded-2xl transition", isActive
                  ? (isLight ? "bg-slate-900 text-white font-semibold shadow-lg shadow-slate-200/30" : isDark ? "bg-white text-black font-semibold" : "bg-white text-slate-950 font-semibold")
                  : (isLight ? "text-slate-600 hover:bg-slate-100" : isDark ? "text-white/72 hover:bg-white/6" : "text-slate-300 hover:bg-white/5"))
              }
            >
              <item.Icon className="w-5 h-5" />
              <span>{item.label}</span>
              {item.label === "Messages" && unreadChats > 0 && (
                <span className="absolute right-3 bg-lime-300 text-slate-950 text-xs font-bold px-2 py-1 rounded-full">
                  {unreadChats}
                </span>
              )}
              {item.label === "Notifications" && unreadNotifications > 0 && (
                <span className="absolute right-3 bg-cyan-300 text-slate-950 text-xs font-bold px-2 py-1 rounded-full">
                  {unreadNotifications}
                </span>
              )}
            </NavLink>
          ))}
        </div>

        <Link
          to="/app/create-post"
          onClick={() => setSidebarOpen(false)}
          className="mx-4 mt-6 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-lime-300 via-cyan-300 to-fuchsia-300 py-3 font-semibold text-slate-950 transition hover:brightness-105 active:scale-95 sm:mx-6"
        >
          <CirclePlus className="w-5 h-5" />
          Create
        </Link>
      </div>

      <div className={clsx("flex w-full items-center justify-between border-t p-4 px-4 sm:px-6", isLight ? "border-slate-200" : "border-white/10")}>
        <div className="flex gap-3 items-center">
          <Avatar src={user?.profile_picture} alt={user?.full_name || "Profile"} size="sm" className={clsx("border", isLight ? "border-slate-200 bg-slate-100" : isDark ? "border-white/10 bg-white/6" : "border-white/10 bg-white/10")} />
          <div>
            <h1 className={clsx("text-sm font-medium", isLight ? "text-slate-900" : "text-white")}>{user?.full_name}</h1>
            <p className={clsx("text-xs", isLight ? "text-slate-500" : isDark ? "text-white/45" : "text-slate-400")}>@{user?.username}</p>
          </div>
        </div>

        <LogOut onClick={logout} className={clsx("w-5 cursor-pointer transition", isLight ? "text-slate-500 hover:text-slate-900" : isDark ? "text-white/55 hover:text-white" : "text-slate-400 hover:text-white")} />
      </div>
    </div>
  );
};

export default Sidebar;
