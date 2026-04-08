import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Volume2, VolumeX } from "lucide-react";
import api from "../api/axios";
import toast from "react-hot-toast";
import PublicShell from "../components/PublicShell";
import { useGuestGate } from "../hooks/useGuestGate";

const PublicReels = () => {
  const [reels, setReels] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [muted, setMuted] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const streamRef = useRef(null);
  const cardRefs = useRef([]);
  const videoRefs = useRef([]);
  const viewedRef = useRef(new Set());
  const { registerInteraction } = useGuestGate();

  const fetchReels = useCallback(async (append = false, nextCursor = null) => {
    try {
      setLoadingMore(true);
      const { data } = await api.get("/api/post/reels/public", {
        params: { ...(nextCursor ? { cursor: nextCursor } : {}) },
      });
      if (data.success) {
        setReels((prev) => (append ? [...prev, ...data.reels] : data.reels));
        setCursor(data.nextCursor || null);
        setHasMore(Boolean(data.hasMore));
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingMore(false);
    }
  }, []);

  const scrollToReel = useCallback((index) => {
    const card = cardRefs.current[index];
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, []);

  useEffect(() => {
    setCursor(null);
    setHasMore(true);
    setActiveIndex(0);
    viewedRef.current.clear();
    fetchReels(false, null);
  }, [fetchReels]);

  useEffect(() => {
    if (!reels.length) return;

    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      video.muted = muted;
      if (index === activeIndex) {
        video.play().catch(() => {});
        if (!viewedRef.current.has(reels[index]?._id)) {
          viewedRef.current.add(reels[index]?._id);
          api.post("/api/post/reels/view", { postId: reels[index]?._id }).catch(() => {});
        }
      } else {
        video.pause();
      }
    });
  }, [activeIndex, muted, reels]);

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
      { root: streamRef.current, threshold: [0.55, 0.75, 0.95] }
    );

    cardRefs.current.forEach((card) => {
      if (card) observer.observe(card);
    });

    return () => observer.disconnect();
  }, [reels]);

  useEffect(() => {
    if (!hasMore || loadingMore || activeIndex < reels.length - 3) return;
    fetchReels(true, cursor);
  }, [activeIndex, cursor, fetchReels, hasMore, loadingMore, reels.length]);

  const handleEnded = useCallback(() => {
    registerInteraction();
    const nextIndex = activeIndex + 1;
    if (nextIndex < reels.length) {
      scrollToReel(nextIndex);
      return;
    }
    if (hasMore && !loadingMore) {
      fetchReels(true, cursor);
    }
  }, [activeIndex, cursor, fetchReels, hasMore, loadingMore, reels.length, registerInteraction, scrollToReel]);

  return (
    <PublicShell
      title="Swipe through public reels before you join."
      subtitle="Watch public creators for a limited guest session, then create an account to unlock your own personalized reel feed."
      active="reels"
    >
      <div ref={streamRef} onWheel={registerInteraction} onTouchMove={registerInteraction} className="h-[calc(100vh-12rem)] snap-y snap-mandatory overflow-y-auto scroll-smooth no-scrollbar">
        {reels.map((reel, index) => (
          <section
            key={reel._id}
            ref={(node) => {
              cardRefs.current[index] = node;
            }}
            data-index={index}
            className="flex min-h-full snap-start items-center justify-center px-3 py-4 sm:px-6"
          >
            <article className="relative h-[82vh] w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-2xl shadow-black/30">
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
              <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 text-xs text-white/80">
                <span>{index + 1} / {reels.length}</span>
                <button onClick={() => setMuted((prev) => !prev)} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 backdrop-blur">
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  {muted ? "Muted" : "Sound on"}
                </button>
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/60 to-transparent p-5 sm:p-6">
                <h3 className="text-lg font-semibold">{reel.user?.full_name}</h3>
                <p className="mt-1 text-sm text-slate-300">@{reel.user?.username || "creator"}</p>
                <p className="mt-3 text-sm leading-6 text-slate-200">{reel.caption || reel.content || "Untitled reel"}</p>
                <div className="mt-5 flex items-center justify-between text-xs text-slate-300">
                  <span>{reel.likeCount || 0} likes</span>
                  <button onClick={() => { registerInteraction(); scrollToReel(Math.min(activeIndex + 1, reels.length - 1)); }} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 backdrop-blur">
                    Next reel
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          </section>
        ))}
      </div>
    </PublicShell>
  );
};

export default PublicReels;
