import React, { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import Feed from "./pages/Feed";
import Connections from "./pages/Connections";
import Profile from "./pages/Profile";
import CreatePost from "./pages/CreatePost";
import Layout from "./pages/Layout";
import MessageWS from "./pages/messageWS/MessageWS";
import ChatBox from "./pages/messageWS/ChatBox";
import SocketProvider from "./socket/SocketProvider";
import { Toaster } from "react-hot-toast";
import { useAuth } from "./auth/AuthProvider";
import Reels from "./pages/Reels";
import Loading from "./components/Loading";
import { useSelector } from "react-redux";
import PublicFeed from "./pages/PublicFeed";
import PublicReels from "./pages/PublicReels";

const ProtectedApp = ({ isAuthenticated, user, children }) => {
  const location = useLocation();

  if (!isAuthenticated) {
    const next = `${location.pathname}${location.search || ""}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  if (!user) {
    return <Loading />;
  }

  return children;
};

const OAuthCallback = () => {
  const { search } = useLocation();
  const { finishOAuth, consumeNextPath } = useAuth();

  useEffect(() => {
    const token = new URLSearchParams(search).get("token");
    if (token) {
      finishOAuth(token).then(() => {
        window.location.replace(consumeNextPath());
      });
    } else {
      window.location.replace("/");
    }
  }, [search, finishOAuth, consumeNextPath]);

  return <Loading />;
};

const App = () => {
  const { isAuthenticated, ready } = useAuth();
  const user = useSelector((state) => state.user.value);

  if (!ready) {
    return <Loading />;
  }

  return (
    <>
      <Toaster position="top-center" toastOptions={{ style: { background: "#111827", color: "#fff", border: "1px solid rgba(255,255,255,.12)" } }} />
      <SocketProvider>
        <Routes>
          <Route path="/oauth/callback" element={<OAuthCallback />} />
          <Route path="/" element={isAuthenticated ? <Navigate to="/app" replace /> : <PublicFeed />} />
          <Route path="/public-reels" element={isAuthenticated ? <Navigate to="/app/reels" replace /> : <PublicReels />} />
          <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/app" replace />} />
          <Route path="/app" element={<ProtectedApp isAuthenticated={isAuthenticated} user={user}><Layout /></ProtectedApp>}>
            <Route index element={<Feed />} />
            <Route path="reels" element={<Reels />} />
            <Route path="connections" element={<Connections />} />
            <Route path="discover" element={<Navigate to="/app/connections" replace />} />
            <Route path="profile" element={<Profile />} />
            <Route path="profile/:profileId" element={<Profile />} />
            <Route path="create-post" element={<CreatePost />} />
            <Route path="messages" element={<MessageWS />} />
            <Route path="messages/:chatId" element={<ChatBox />} />
          </Route>
        </Routes>
      </SocketProvider>
    </>
  );
};

export default App;
