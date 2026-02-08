import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Home,
  MessageCircle,
  Search,
  UserIcon,
  Users,
  CirclePlus,
  LogOut,
} from "lucide-react";
import { UserButton, useClerk, useUser } from "@clerk/clerk-react";
import { useSocket } from "../hooks/useSocket";

/* ---------------- MENU ASSETS ---------------- */

const menuItems = [
  { to: "/", label: "Feed", Icon: Home },
  { to: "/messages", label: "Messages", Icon: MessageCircle },
  { to: "/connections", label: "Connections", Icon: Users },
  { to: "/discover", label: "Discover", Icon: Search },
  { to: "/profile", label: "Profile", Icon: UserIcon },
];

/* ---------------- SIDEBAR ---------------- */

const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
  const navigate = useNavigate();
  const { signOut } = useClerk();
  const { user } = useUser();
  const socket = useSocket();

  const [unreadChats, setUnreadChats] = useState(0);

  /* 🔌 SOCKET: unread chat count */
  useEffect(() => {
    if (!socket || !user?.id) return;

    socket.emit("join_user", user.id);

    socket.on("unread_chats_count", ({ count }) => {
      setUnreadChats(count);
    });

    return () => {
      socket.off("unread_chats_count");
    };
  }, [socket, user?.id]);

  return (
    <div
      className={`sticky w-60 xl:w-72 bg-white border-r border-gray-200 flex flex-col justify-between max-sm:absolute top-0 bottom-0 z-20
      ${sidebarOpen ? "translate-x-0" : "max-sm:-translate-x-full"}
      transition-all duration-300 ease-in-out`}
    >
      {/* -------- TOP -------- */}
      <div className="w-full">
        <img
          onClick={() => navigate("/")}
          src="/logo.png"
          alt="logo"
          className="w-28 ml-6 my-3 cursor-pointer"
        />

        <hr className="border-gray-200 mb-6" />

        {/* -------- MENU -------- */}
        <div className="px-4 space-y-1">
          {menuItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-3 py-2 rounded-lg transition
                ${
                  isActive
                    ? "bg-slate-100 font-medium"
                    : "hover:bg-slate-100"
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>

              {/* 🔴 UNREAD CHAT BADGE */}
              {label === "Messages" && unreadChats > 0 && (
                <span className="absolute right-3 bg-indigo-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {unreadChats}
                </span>
              )}
            </NavLink>
          ))}
        </div>

        {/* -------- CREATE POST -------- */}
        <Link
          to="/create-post"
          onClick={() => setSidebarOpen(false)}
          className="flex items-center justify-center gap-2 py-2.5 mt-6 mx-6 rounded-lg
          bg-gradient-to-r from-purple-500 to-indigo-600
          hover:from-purple-700 hover:to-indigo-800
          active:scale-95 transition text-white"
        >
          <CirclePlus className="w-5 h-5" />
          Create Post
        </Link>
      </div>

      {/* -------- BOTTOM -------- */}
      <div className="w-full border-t border-gray-200 p-4 px-6 flex items-center justify-between">
        <div className="flex gap-2 items-center">
          <UserButton />
          <div>
            <h1 className="text-sm font-medium">{user?.full_name}</h1>
            <p className="text-xs text-gray-500">@{user?.username}</p>
          </div>
        </div>

        <LogOut
          onClick={signOut}
          className="w-5 text-gray-400 cursor-pointer hover:text-gray-700 transition"
        />
      </div>
    </div>
  );
};

export default Sidebar;
