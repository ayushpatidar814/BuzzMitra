import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";
import toast from "react-hot-toast";
import Loading from "../components/Loading";
import PostCard from "../components/PostCard";
import PublicShell from "../components/PublicShell";
import { useGuestGate } from "../hooks/useGuestGate";

const PublicFeed = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { registerInteraction } = useGuestGate();

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/api/post/feed/public");
      if (data.success) {
        setPosts(data.posts);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

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
      </div>
    </PublicShell>
  );
};

export default PublicFeed;
