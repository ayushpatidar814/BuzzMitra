import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/axios";
import toast from "react-hot-toast";
import Loading from "../components/Loading";
import PostCard from "../components/PostCard";
import PublicShell from "../components/PublicShell";
import { useGuestGate } from "../hooks/useGuestGate";

const PublicFeed = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef(null);
  const { registerInteraction } = useGuestGate();

  const fetchPosts = useCallback(async (cursor = null, append = false) => {
    try {
      if (append) setLoadingMore(true);
      else setLoading(true);

      const { data } = await api.getDedup("/api/post/feed/public", {
        params: {
          limit: 10,
          ...(cursor ? { cursor } : {}),
        },
      });

      if (data.success) {
        setPosts((prev) => (append ? [...prev, ...(data.posts || [])] : (data.posts || [])));
        setNextCursor(data.nextCursor || null);
        setHasMore(Boolean(data.hasMore));
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setPosts([]);
    setNextCursor(null);
    setHasMore(true);
    fetchPosts(null, false);
  }, [fetchPosts]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting && nextCursor) {
          registerInteraction();
          fetchPosts(nextCursor, true);
        }
      },
      { rootMargin: "500px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchPosts, hasMore, loading, loadingMore, nextCursor, registerInteraction]);

  if (loading) return <Loading />;

  return (
    <PublicShell
      title="See what people are sharing before you join."
      subtitle="Browse public posts and stories for a limited guest session. Create an account to follow people, join conversations, and make the feed yours."
      active="feed"
    >
      <div onWheel={registerInteraction} onTouchMove={registerInteraction} className="mx-auto max-w-2xl space-y-6">
        {posts.map((post) => (
          <PostCard key={post._id} post={post} readOnly onRequireAuth={registerInteraction} />
        ))}

        <div ref={sentinelRef} className="h-6" />

        {loadingMore && (
          <div className="rounded-[1.6rem] border border-white/10 bg-white/5 px-5 py-4 text-center text-sm text-slate-200 backdrop-blur">
            Loading more posts...
          </div>
        )}

        {!hasMore && posts.length > 0 && (
          <div className="rounded-[1.6rem] border border-white/10 bg-white/5 px-5 py-4 text-center text-sm text-slate-200 backdrop-blur">
            You have reached the latest public posts.
          </div>
        )}
      </div>
    </PublicShell>
  );
};

export default PublicFeed;
