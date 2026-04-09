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
} from "lucide-react";
import { useSelector } from "react-redux";
import { selectTotalUnread } from "../features/messagesWS/chatSelectors";
import { useAuth } from "../auth/AuthProvider";
import Avatar from "./Avatar";

const menuItems = [
  { to: "/app", label: "Feed", Icon: Home },
  { to: "/app/reels", label: "Reels", Icon: Clapperboard },
  { to: "/app/messages", label: "Messages", Icon: MessageCircle },
  { to: "/app/notifications", label: "Notifications", Icon: BellRing },
  { to: "/app/connections", label: "People", Icon: Users },
  { to: "/app/profile", label: "Profile", Icon: UserIcon },
];

const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const user = useSelector((state) => state.user.value);
  const unreadChats = useSelector(selectTotalUnread);
  const unreadNotifications = useSelector((state) => state.notifications.unreadCount);

  return (
    <div
      className={`sticky top-0 h-screen w-72 bg-slate-950/92 text-white border-r border-white/10 backdrop-blur-xl flex flex-col justify-between max-sm:absolute max-sm:inset-y-0 z-20
      ${sidebarOpen ? "translate-x-0" : "max-sm:-translate-x-full"}
      transition-all duration-300 ease-in-out`}
    >
      <div className="w-full">
        <img onClick={() => navigate("/app")} src="/logo.png" alt="logo" className="w-28 ml-6 my-5 cursor-pointer" />

        <div className="mx-6 rounded-3xl border border-lime-300/20 bg-gradient-to-br from-lime-300/10 via-cyan-400/5 to-fuchsia-400/10 p-4 mb-6">
          <p className="text-xs uppercase tracking-[0.28em] text-lime-200/70">Today on BuzzMitra</p>
          <h2 className="mt-2 text-xm font-semibold leading-tight">Catch up on people you follow, jump into chats, and discover what is trending.</h2>
        </div>

        <div className="px-4 space-y-2">
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/app"}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-4 py-3 rounded-2xl transition ${
                  isActive ? "bg-white text-slate-950 font-semibold" : "text-slate-300 hover:bg-white/5"
                }`
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
          className="flex items-center justify-center gap-2 py-3 mt-6 mx-6 rounded-2xl bg-gradient-to-r from-lime-300 via-cyan-300 to-fuchsia-300 hover:brightness-105 active:scale-95 transition text-slate-950 font-semibold"
        >
          <CirclePlus className="w-5 h-5" />
          Create
        </Link>
      </div>

      <div className="w-full border-t border-white/10 p-4 px-6 flex items-center justify-between">
        <div className="flex gap-3 items-center">
          <Avatar src={user?.profile_picture} alt={user?.full_name || "Profile"} size="sm" className="border border-white/10 bg-white/10" />
          <div>
            <h1 className="text-sm font-medium">{user?.full_name}</h1>
            <p className="text-xs text-slate-400">@{user?.username}</p>
          </div>
        </div>

        <LogOut onClick={logout} className="w-5 text-slate-400 cursor-pointer hover:text-white transition" />
      </div>
    </div>
  );
};

export default Sidebar;
