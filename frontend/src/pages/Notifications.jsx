import { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, CheckCheck, Heart, MessageCircle, Repeat2, UserPlus, Users } from "lucide-react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import moment from "moment";
import toast from "react-hot-toast";
import api from "../api/axios";
import { useAuth } from "../auth/AuthProvider";
import Avatar from "../components/Avatar";
import Loading from "../components/Loading";
import { useThemeSettings } from "../theme/ThemeProvider";
import clsx from "clsx";
import {
  decrementUnreadNotifications,
  setUnreadNotificationsCount,
} from "../features/notifications/notificationsSlice";

const typeMeta = {
  follow: { label: "Follows", Icon: UserPlus, color: "text-cyan-300 bg-cyan-400/10" },
  like_post: { label: "Likes", Icon: Heart, color: "text-rose-300 bg-rose-400/10" },
  comment_post: { label: "Comments", Icon: MessageCircle, color: "text-amber-300 bg-amber-400/10" },
  reply_comment: { label: "Replies", Icon: MessageCircle, color: "text-lime-300 bg-lime-400/10" },
  share_post: { label: "Shares", Icon: Repeat2, color: "text-fuchsia-300 bg-fuchsia-400/10" },
  message: { label: "Messages", Icon: MessageCircle, color: "text-sky-300 bg-sky-400/10" },
  story_reply: { label: "Story replies", Icon: MessageCircle, color: "text-orange-300 bg-orange-400/10" },
  group_added: { label: "Groups", Icon: Users, color: "text-violet-300 bg-violet-400/10" },
  group_promoted: { label: "Groups", Icon: Users, color: "text-violet-300 bg-violet-400/10" },
  group_owner_transferred: { label: "Groups", Icon: Users, color: "text-violet-300 bg-violet-400/10" },
};

const Notifications = () => {
  const { authHeaders } = useAuth();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState("all");
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const { theme } = useThemeSettings();
  const isLight = theme === "light";
  const isDark = theme === "dark";

  const fetchNotifications = useCallback(async (append = false, nextCursor = null, nextFilter = filter) => {
    try {
      append ? setLoadingMore(true) : setLoading(true);
      const { data } = await api.getDedup("/api/notifications", {
        headers: authHeaders,
        params: {
          filter: nextFilter,
          ...(nextCursor ? { cursor: nextCursor } : {}),
        },
      });
      if (!data.success) throw new Error(data.message);
      setItems((prev) => (append ? [...prev, ...(data.notifications || [])] : (data.notifications || [])));
      setCursor(data.nextCursor || null);
      setHasMore(Boolean(data.hasMore));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [authHeaders, filter]);

  useEffect(() => {
    setItems([]);
    setCursor(null);
    setHasMore(true);
    fetchNotifications(false, null, filter);
  }, [fetchNotifications, filter]);

  const unreadCount = useMemo(() => items.filter((item) => !item.readAt).length, [items]);

  const openNotification = async (item) => {
    try {
      if (!item.readAt) {
        await api.post(`/api/notifications/${item._id}/read`, {}, { headers: authHeaders });
        setItems((prev) => prev.map((notification) => notification._id === item._id ? { ...notification, readAt: new Date().toISOString() } : notification));
        dispatch(decrementUnreadNotifications());
      }
    } catch {
      // Navigation should still continue even if the read marker request fails.
    }

    navigate(item.link || "/app/notifications");
  };

  const markAllRead = async () => {
    try {
      setMarkingAll(true);
      const { data } = await api.post("/api/notifications/mark-all-read", {}, { headers: authHeaders });
      if (!data.success) throw new Error(data.message);
      setItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
      dispatch(setUnreadNotificationsCount(0));
      toast.success("All notifications marked as read");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setMarkingAll(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="px-4 pb-12 pt-8 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className={clsx("rounded-[2rem] border p-6 shadow-2xl", isLight ? "border-slate-200 bg-white text-slate-900 shadow-slate-200/30" : isDark ? "border-white/10 bg-black/84 text-white shadow-black/35" : "border-white/10 bg-slate-950/85 text-white shadow-slate-950/30")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className={clsx("text-sm uppercase tracking-[0.24em]", isLight ? "text-cyan-600" : isDark ? "text-white/58" : "text-lime-300")}>Notifications</p>
              <h1 className="mt-3 text-3xl font-semibold">Stay in sync with everything happening around you.</h1>
              <p className={clsx("mt-3 max-w-2xl", isLight ? "text-slate-600" : isDark ? "text-white/70" : "text-slate-300")}>Follow activity, post engagement, replies, direct messages, and group updates all in one place.</p>
            </div>
            <button
              onClick={markAllRead}
              disabled={markingAll || unreadCount === 0}
              className={clsx("inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium disabled:opacity-50", isLight ? "border-slate-200 bg-slate-50 text-slate-900" : isDark ? "border-white/10 bg-white/6 text-white" : "border-white/10 bg-white/5 text-white")}
            >
              <CheckCheck className="h-4 w-4" />
              {markingAll ? "Marking..." : "Mark all as read"}
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {["all", "unread"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={clsx("rounded-2xl px-4 py-2.5 text-sm font-medium transition", filter === tab
                ? "bg-white text-slate-950"
                : isLight ? "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50" : isDark ? "bg-white/6 text-white/80 hover:bg-white/10" : "bg-white/10 text-white/80 hover:bg-white/15")}
            >
              {tab === "all" ? "All activity" : "Unread only"}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-4">
          {items.length > 0 ? items.map((item) => {
            const meta = typeMeta[item.type] || { label: "Activity", Icon: BellRing, color: "text-white bg-white/10" };
            return (
              <button
                key={item._id}
                onClick={() => openNotification(item)}
                className={clsx("w-full rounded-[1.8rem] border p-5 text-left shadow-xl transition", isLight
                  ? (item.readAt ? "border-slate-200 bg-white text-slate-900 shadow-slate-200/30" : "border-slate-200 bg-slate-900 text-white shadow-slate-300/20")
                  : isDark
                    ? (item.readAt ? "border-white/10 bg-black/70 text-white shadow-black/30" : "border-white/10 bg-black text-white shadow-black/35")
                    : (item.readAt ? "border-slate-200 bg-slate-950/10 text-white shadow-slate-950/30" : "border-slate-200 bg-slate-950/90 text-white shadow-slate-950/30"))}
              >
                <div className="flex items-start gap-4">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (item.actor?._id) {
                        navigate(`/app/profile/${item.actor._id}`);
                      }
                    }}
                    className="shrink-0"
                  >
                    <Avatar src={item.actor?.profile_picture} alt={item.actor?.full_name || item.title} size="sm" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${meta.color}`}>
                        <meta.Icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                      {!item.readAt && <span className="rounded-full bg-lime-300 px-2 py-1 text-[10px] font-semibold text-slate-950">New</span>}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {item.actor?._id && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/app/profile/${item.actor._id}`);
                          }}
                          className={clsx("text-left text-sm font-semibold", isLight ? "text-cyan-700 hover:text-cyan-600" : "text-cyan-300 hover:text-cyan-200")}
                        >
                          {item.actor?.full_name}
                        </button>
                      )}
                      <h3 className="text-lg font-semibold">{item.title || "New activity"}</h3>
                    </div>
                    <p className={clsx("mt-2 text-sm leading-6", isLight ? (item.readAt ? "text-slate-500" : "text-slate-100") : isDark ? (item.readAt ? "text-white/52" : "text-white/74") : (item.readAt ? "text-slate-500" : "text-slate-300"))}>{item.text || "Open to see more details."}</p>
                    <div className={clsx("mt-3 text-xs", isLight ? (item.readAt ? "text-slate-400" : "text-slate-200") : isDark ? (item.readAt ? "text-white/35" : "text-white/45") : (item.readAt ? "text-slate-400" : "text-white/50"))}>
                      {moment(item.createdAt).fromNow()}
                    </div>
                  </div>
                </div>
              </button>
            );
          }) : (
            <div className={clsx("rounded-[1.8rem] border border-dashed px-6 py-16 text-center text-sm", isLight ? "border-slate-200 bg-white text-slate-500" : isDark ? "border-white/12 bg-white/4 text-white/55" : "border-white/15 bg-white/5 text-white/60")}>
              No notifications to show right now.
            </div>
          )}
        </div>

        {hasMore && items.length > 0 && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => fetchNotifications(true, cursor, filter)}
              disabled={loadingMore}
              className={clsx("rounded-2xl border px-5 py-3 text-sm font-medium disabled:opacity-60", isLight ? "border-slate-200 bg-white text-slate-900" : isDark ? "border-white/10 bg-white/6 text-white" : "border-white/10 bg-white/5 text-white")}
            >
              {loadingMore ? "Loading..." : "Load more notifications"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
