import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Eye,
  Heart,
  MessageCircle,
  Music2,
  Send,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import { useAuth } from "../auth/AuthProvider";
import Loading from "../components/Loading";
import Avatar from "../components/Avatar";

const Reels = () => {
  const { authHeaders } = useAuth();
  const currentUser = useSelector((state) => state.user.value);
  const navigate = useNavigate();
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const streamRef = useRef(null);
  const cardRefs = useRef([]);
  const videoRefs = useRef([]);
  const viewedRef = useRef(new Set());

  const activeReel = reels[activeIndex] || null;
  const isOwnReel = activeReel?.user?._id && String(activeReel.user._id) === String(currentUser?._id);

  const fetchReels = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/api/post/reels/feed", { headers: authHeaders });
      if (data.success) {
        setReels(data.reels || []);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  const replaceReel = useCallback((nextReel) => {
    if (!nextReel?._id) return;
    setReels((prev) => prev.map((reel) => (reel._id === nextReel._id ? nextReel : reel)));
  }, []);

  const scrollToReel = useCallback((index) => {
    const nextCard = cardRefs.current[index];
    if (nextCard) {
      nextCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, []);

  const trackView = useCallback(
    (reelId) => {
      if (!reelId || viewedRef.current.has(reelId)) return;
      viewedRef.current.add(reelId);
      api.post("/api/post/reels/view", { postId: reelId }, { headers: authHeaders }).catch(() => {});
      setReels((prev) =>
        prev.map((reel) =>
          reel._id === reelId ? { ...reel, view_count: Number(reel.view_count || 0) + 1 } : reel
        )
      );
    },
    [authHeaders]
  );

  useEffect(() => {
    setActiveIndex(0);
    viewedRef.current.clear();
    fetchReels();
  }, [fetchReels]);

  useEffect(() => {
    if (!reels.length) return;

    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      video.muted = muted;
      if (index === activeIndex) {
        video.play().catch(() => {});
        trackView(reels[index]?._id);
      } else {
        video.pause();
      }
    });
  }, [activeIndex, muted, reels, trackView]);

  useEffect(() => {
    if (!streamRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visibleEntry) return;
        const nextIndex = Number(visibleEntry.target.dataset.index);
        if (!Number.isNaN(nextIndex)) {
          setActiveIndex(nextIndex);
        }
      },
      {
        root: streamRef.current,
        threshold: [0.55, 0.75, 0.95],
      }
    );

    cardRefs.current.forEach((card) => {
      if (card) observer.observe(card);
    });

    return () => observer.disconnect();
  }, [reels]);

  useEffect(() => {
    setCommentsOpen(false);
    setCommentDraft("");
    setReplyDrafts({});
    setReplyingTo(null);
  }, [activeIndex]);

  const handleEnded = useCallback(() => {
    const nextIndex = activeIndex + 1;
    if (nextIndex < reels.length) {
      scrollToReel(nextIndex);
    }
  }, [activeIndex, reels.length, scrollToReel]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        scrollToReel(Math.min(activeIndex + 1, reels.length - 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        scrollToReel(Math.max(activeIndex - 1, 0));
      }
      if (event.key.toLowerCase() === "m") {
        setMuted((prev) => !prev);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, reels.length, scrollToReel]);

  const runAction = useCallback(
    async (url, payload, successMessage) => {
      if (!activeReel?._id) return;
      try {
        setBusyAction(url);
        const { data } = await api.post(url, payload, { headers: authHeaders });
        if (!data.success) throw new Error(data.message);
        if (data.post) replaceReel(data.post);
        if (successMessage || data.message) toast.success(successMessage || data.message);
      } catch (error) {
        toast.error(error.message);
      } finally {
        setBusyAction("");
      }
    },
    [activeReel?._id, authHeaders, replaceReel]
  );

  const handleShare = useCallback(async () => {
    if (!activeReel?._id) return;

    const shareUrl = `${window.location.origin}/app/reels?reel=${activeReel._id}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${activeReel.user?.full_name || "BuzzMitra"} on BuzzMitra Reels`,
          text: activeReel.caption || activeReel.content || "Watch this reel on BuzzMitra",
          url: shareUrl,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }

      await runAction("/api/post/share", { postId: activeReel._id }, "Reel shared");
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast.error(error.message || "Unable to share this reel");
      }
    }
  }, [activeReel, runAction]);

  const submitComment = useCallback(async () => {
    if (!activeReel?._id || !commentDraft.trim()) return;
    try {
      setBusyAction("comment");
      const { data } = await api.post(
        "/api/post/comment",
        { postId: activeReel._id, text: commentDraft.trim() },
        { headers: authHeaders }
      );
      if (!data.success) throw new Error(data.message);
      replaceReel(data.post);
      setCommentDraft("");
      setCommentsOpen(true);
      toast.success("Comment added");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyAction("");
    }
  }, [activeReel?._id, authHeaders, commentDraft, replaceReel]);

  const submitReply = useCallback(
    async (commentId) => {
      const text = replyDrafts[commentId]?.trim();
      if (!activeReel?._id || !text) return;
      try {
        setBusyAction(`reply-${commentId}`);
        const { data } = await api.post(
          "/api/post/comment/reply",
          { postId: activeReel._id, commentId, text },
          { headers: authHeaders }
        );
        if (!data.success) throw new Error(data.message);
        replaceReel(data.post);
        setReplyDrafts((prev) => ({ ...prev, [commentId]: "" }));
        setReplyingTo(null);
        toast.success("Reply added");
      } catch (error) {
        toast.error(error.message);
      } finally {
        setBusyAction("");
      }
    },
    [activeReel?._id, authHeaders, replyDrafts, replaceReel]
  );

  const deleteComment = useCallback(
    async (commentId) => {
      if (!activeReel?._id) return;
      try {
        setBusyAction(`delete-${commentId}`);
        const { data } = await api.post(
          "/api/post/comment/delete",
          { postId: activeReel._id, commentId },
          { headers: authHeaders }
        );
        if (!data.success) throw new Error(data.message);
        replaceReel(data.post);
        toast.success("Comment removed");
      } catch (error) {
        toast.error(error.message);
      } finally {
        setBusyAction("");
      }
    },
    [activeReel?._id, authHeaders, replaceReel]
  );

  const backdropStyle = useMemo(
    () =>
      activeReel?.thumbnail_url
        ? {
            backgroundImage: `radial-gradient(circle at top left, rgba(163,230,53,.14), transparent 20%), radial-gradient(circle at 78% 12%, rgba(34,211,238,.16), transparent 18%), linear-gradient(180deg, rgba(244,114,182,.08), transparent 32%), url(${activeReel.thumbnail_url})`,
          }
        : undefined,
    [activeReel?.thumbnail_url]
  );

  const renderCommentThread = useCallback(
    (items = [], depth = 0) =>
      items.map((item) => {
        const canDelete =
          isOwnReel || String(item.user?._id || "") === String(currentUser?._id || "");

        return (
          <div
            key={item._id}
            className={`rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-4 ${
              depth > 0 ? "ml-4 mt-3" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar src={item.user?.profile_picture} alt={item.user?.full_name || "BuzzMitra user"} size="xs" />
                <div className="min-w-0">
                  <button
                    onClick={() => navigate(`/app/profile/${item.user?._id}`)}
                    className="truncate text-left text-sm font-semibold text-white"
                  >
                    {item.user?.full_name || "BuzzMitra user"}
                  </button>
                  <p className="truncate text-xs text-white/55">@{item.user?.username || "user"}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    runAction("/api/post/comment/like", { postId: activeReel._id, commentId: item._id })
                  }
                  className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2.5 py-1.5 text-xs text-white/80"
                >
                  <Heart className={`h-4 w-4 ${item.isLiked ? "fill-rose-500 text-rose-500" : ""}`} />
                  {item.likeCount || 0}
                </button>
                {canDelete && (
                  <button
                    onClick={() => deleteComment(item._id)}
                    disabled={busyAction === `delete-${item._id}`}
                    className="rounded-full bg-black/20 p-2 text-white/70 transition hover:text-rose-300 disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <p className="mt-3 text-sm leading-6 text-white/85">{item.text}</p>

            <div className="mt-3 flex items-center gap-3 text-xs text-white/55">
              <button onClick={() => setReplyingTo(replyingTo === item._id ? null : item._id)}>Reply</button>
            </div>

            {replyingTo === item._id && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  value={replyDrafts[item._id] || ""}
                  onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [item._id]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && submitReply(item._id)}
                  placeholder="Write a reply..."
                  className="flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
                />
                <button
                  onClick={() => submitReply(item._id)}
                  disabled={busyAction === `reply-${item._id}`}
                  className="rounded-2xl bg-lime-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
                >
                  Reply
                </button>
              </div>
            )}

            {item.replies?.length > 0 && <div className="mt-3">{renderCommentThread(item.replies, depth + 1)}</div>}
          </div>
        );
      }),
    [
      activeReel?._id,
      busyAction,
      currentUser?._id,
      deleteComment,
      isOwnReel,
      navigate,
      replyDrafts,
      replyingTo,
      runAction,
      submitReply,
    ]
  );

  if (loading) return <Loading />;

  if (!reels.length) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07111f] px-6 text-white">
        <div className="max-w-xl rounded-[2.3rem] border border-white/10 bg-white/[0.05] p-8 text-center shadow-2xl shadow-black/30 backdrop-blur-xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.24em] text-lime-300">
            Reels
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight">No reels to show yet</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Reels from people you follow and public accounts will appear here as soon as they are shared.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen overflow-hidden bg-[#07111f] text-white" style={backdropStyle}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[26px]" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black via-black/45 to-transparent px-4 pb-10 pt-5">
        <div className="mx-auto flex max-w-7xl mt-5 items-center justify-between">
          <div className="pointer-events-auto rounded-full border border-white/10 bg-black/25 px-4 py-2.5 text-xs uppercase tracking-[0.26em] text-lime-300 backdrop-blur">
            Reels
          </div>

          <div className="pointer-events-auto flex items-center gap-3">
            <button
              onClick={() => setMuted((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-4 py-2.5 text-sm font-medium backdrop-blur"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              {muted ? "Muted" : "Sound on"}
            </button>
          </div>
        </div>
      </div>

      <div ref={streamRef} className="relative h-full snap-y snap-mandatory overflow-y-auto scroll-smooth no-scrollbar">
        {reels.map((reel, index) => {
          const ownReel = String(reel.user?._id || "") === String(currentUser?._id || "");

          return (
            <section
              key={reel._id}
              ref={(node) => {
                cardRefs.current[index] = node;
              }}
              data-index={index}
              className="flex min-h-screen snap-start items-center justify-center px-3 py-6 sm:px-6"
            >
              <div className="flex w-full items-center justify-center gap-4 xl:gap-6">
                <article className="relative h-[84vh] w-full max-w-[26rem] overflow-hidden rounded-[2.7rem] border border-white/10 bg-black shadow-[0_30px_120px_rgba(0,0,0,.45)] sm:max-w-[38rem]">
                  <video
                    ref={(node) => {
                      videoRefs.current[index] = node;
                    }}
                    src={reel.media_url}
                    muted={muted}
                    playsInline
                    preload={index <= activeIndex + 1 ? "auto" : "metadata"}
                    onEnded={index === activeIndex ? handleEnded : undefined}
                    className="h-full w-full object-cover"
                  />

                  <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 text-xs text-white/85">
                    <div className="flex items-center gap-2">
                      {reel.reel_emojis && (
                        <span className="rounded-full border border-white/10 bg-black/25 px-3 py-2 backdrop-blur">
                          {reel.reel_emojis}
                        </span>
                      )}
                      {reel.music?.title && (
                        <span className="inline-flex max-w-[10rem] items-center gap-2 truncate rounded-full border border-white/10 bg-black/25 px-3 py-2 backdrop-blur">
                          <Music2 className="h-3.5 w-3.5" />
                          <span className="truncate">{reel.music.title}</span>
                        </span>
                      )}
                    </div>
                    {ownReel && (
                      <span className="rounded-full border border-white/10 bg-black/25 px-3 py-2 backdrop-blur">
                        {reel.view_count || 0} views
                      </span>
                    )}
                  </div>

                  {reel.gif_url && (
                    <div className="absolute right-4 top-16 h-20 w-20 overflow-hidden rounded-[1.4rem] border border-white/10 bg-white/10 backdrop-blur">
                      <img src={reel.gif_url} alt="Reel GIF" className="h-full w-full object-cover" />
                    </div>
                  )}

                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/65 to-transparent p-5 sm:p-6">
                    <div className="flex items-end justify-between gap-4">
                      <div className="min-w-0">
                        <button
                          onClick={() => navigate(`/app/profile/${reel.user?._id}`)}
                          className="inline-flex max-w-full items-center gap-3 rounded-full border border-white/10 bg-black/25 px-3 py-2 text-left backdrop-blur"
                        >
                          <Avatar
                            src={reel.user?.profile_picture}
                            alt={reel.user?.full_name || "creator"}
                            size="xs"
                            className="border border-white/10 bg-white/10"
                          />
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold">{reel.user?.full_name}</h3>
                            <p className="truncate text-[11px] text-white/70">@{reel.user?.username || "creator"}</p>
                          </div>
                        </button>

                        {(reel.caption || reel.content) && (
                          <p className="mt-3 max-w-[17rem] text-sm leading-6 text-slate-200">
                            {reel.caption || reel.content}
                          </p>
                        )}
                      </div>

                      {/* <button
                        onClick={() => scrollToReel(Math.min(activeIndex + 1, reels.length - 1))}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs uppercase tracking-[0.18em] text-white/85 backdrop-blur"
                      >
                        Next
                        <ChevronDown className="h-4 w-4" />
                      </button> */}
                    </div>
                  </div>
                </article>

                <div className="hidden shrink-0 flex-col gap-3 lg:flex">
                  <button
                    onClick={() => runAction("/api/post/like", { postId: reel._id })}
                    className="flex h-16 w-16 flex-col items-center justify-center rounded-[1.8rem] border border-white/10 bg-black/30 text-white shadow-xl backdrop-blur transition hover:scale-[1.02]"
                  >
                    <Heart className={`h-6 w-6 ${reel.isLiked ? "fill-rose-500 text-rose-500" : ""}`} />
                    <span className="mt-1 text-[11px] font-medium">{reel.likeCount || 0}</span>
                  </button>
                  <button
                    onClick={() => setCommentsOpen(true)}
                    className="flex h-16 w-16 flex-col items-center justify-center rounded-[1.8rem] border border-white/10 bg-black/30 text-white shadow-xl backdrop-blur transition hover:scale-[1.02]"
                  >
                    <MessageCircle className="h-6 w-6" />
                    <span className="mt-1 text-[11px] font-medium">{reel.commentCount || 0}</span>
                  </button>
                  <button
                    onClick={handleShare}
                    className="flex h-16 w-16 flex-col items-center justify-center rounded-[1.8rem] border border-white/10 bg-black/30 text-white shadow-xl backdrop-blur transition hover:scale-[1.02]"
                  >
                    <Send className="h-6 w-6" />
                    <span className="mt-1 text-[11px] font-medium">{reel.shareCount || 0}</span>
                  </button>
                  {ownReel && (
                    <button
                      onClick={() => setCommentsOpen(true)}
                      className="flex h-16 w-16 flex-col items-center justify-center rounded-[1.8rem] border border-white/10 bg-lime-300/90 text-slate-950 shadow-xl backdrop-blur transition hover:scale-[1.02]"
                    >
                      <Eye className="h-6 w-6" />
                      <span className="mt-1 text-[11px] font-semibold">{reel.view_count || 0}</span>
                    </button>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 px-4 lg:hidden">
        <div className="pointer-events-auto mx-auto flex max-w-[28rem] items-center justify-center gap-2 rounded-[1.8rem] border border-white/10 bg-black/35 p-2 backdrop-blur-xl">
          <button
            onClick={() => runAction("/api/post/like", { postId: activeReel?._id })}
            className="flex flex-1 items-center justify-center gap-2 rounded-[1.2rem] px-4 py-3 text-sm text-white"
          >
            <Heart className={`h-5 w-5 ${activeReel?.isLiked ? "fill-rose-500 text-rose-500" : ""}`} />
            {activeReel?.likeCount || 0}
          </button>
          <button
            onClick={() => setCommentsOpen(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-[1.2rem] px-4 py-3 text-sm text-white"
          >
            <MessageCircle className="h-5 w-5" />
            {activeReel?.commentCount || 0}
          </button>
          <button
            onClick={handleShare}
            className="flex flex-1 items-center justify-center gap-2 rounded-[1.2rem] px-4 py-3 text-sm text-white"
          >
            <Send className="h-5 w-5" />
            {activeReel?.shareCount || 0}
          </button>
          {isOwnReel && (
            <button
              onClick={() => setCommentsOpen(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-[1.2rem] bg-lime-300 px-4 py-3 text-sm font-semibold text-slate-950"
            >
              <Eye className="h-5 w-5" />
              {activeReel?.view_count || 0}
            </button>
          )}
        </div>
      </div>

      {commentsOpen && activeReel && (
        <div className="absolute inset-0 z-30 bg-black/55 backdrop-blur-sm">
          <div className="absolute inset-y-0 right-0 w-full max-w-xl border-l border-white/10 bg-[#08111f]/95 px-5 py-5 shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-lime-300">
                  {isOwnReel ? "Views & comments" : "Comments"}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {activeReel.commentCount || 0} conversation{activeReel.commentCount === 1 ? "" : "s"}
                </h2>
              </div>
              <button
                onClick={() => setCommentsOpen(false)}
                className="rounded-full border border-white/10 bg-white/5 p-2 text-white/80"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isOwnReel && (
              <div className="mt-4 rounded-[1.6rem] border border-white/10 bg-white/[0.05] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/50">Views</p>
                <div className="mt-2 inline-flex items-center gap-2 text-2xl font-semibold text-white">
                  <Eye className="h-5 w-5 text-lime-300" />
                  {activeReel.view_count || 0}
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center gap-3 rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-3">
              <Avatar src={currentUser?.profile_picture} alt="You" size="sm" />
              <input
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitComment()}
                placeholder="Write a comment..."
                className="flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
              />
              <button
                onClick={submitComment}
                disabled={busyAction === "comment"}
                className="rounded-2xl bg-lime-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                Post
              </button>
            </div>

            <div className="mt-4 h-[calc(100vh-16rem)] space-y-3 overflow-y-auto pr-1 no-scrollbar">
              {activeReel.comments?.length ? (
                renderCommentThread([...activeReel.comments].reverse())
              ) : (
                <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-6 text-center text-sm text-white/60">
                  No comments yet. Start the conversation for this reel.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reels;
