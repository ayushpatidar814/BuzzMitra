import React, { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import Feed from "./pages/Feed";
import Layout from "./pages/Layout";
import SocketProvider from "./socket/SocketProvider";
import { Toaster } from "react-hot-toast";
import { useAuth } from "./auth/AuthProvider";
import Loading from "./components/Loading";
import { useSelector } from "react-redux";
import PublicFeed from "./pages/PublicFeed";
import { useThemeSettings } from "./theme/ThemeProvider";

const Reels = lazy(() => import("./pages/Reels"));
const Connections = lazy(() => import("./pages/Connections"));
const Profile = lazy(() => import("./pages/Profile"));
const CreatePost = lazy(() => import("./pages/CreatePost"));
const MessageWS = lazy(() => import("./pages/messageWS/MessageWS"));
const ChatBox = lazy(() => import("./pages/messageWS/ChatBox"));
const PublicReels = lazy(() => import("./pages/PublicReels"));
const Notifications = lazy(() => import("./pages/Notifications"));
const SettingsPage = lazy(() => import("./pages/Settings"));

const LazyPage = ({ children }) => <Suspense fallback={<Loading />}>{children}</Suspense>;

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
  const { theme } = useThemeSettings();
  const user = useSelector((state) => state.user.value);

  if (!ready) {
    return <Loading />;
  }

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          style: theme === "light"
            ? { background: "#ffffff", color: "#0f172a", border: "1px solid rgba(148,163,184,.28)", boxShadow: "0 18px 60px rgba(15,23,42,.12)" }
            : theme === "dark"
              ? { background: "#050505", color: "#ffffff", border: "1px solid rgba(255,255,255,.14)", boxShadow: "0 18px 60px rgba(0,0,0,.45)" }
              : { background: "#111827", color: "#fff", border: "1px solid rgba(255,255,255,.12)" },
        }}
      />
      <SocketProvider>
        <Routes>
          <Route path="/oauth/callback" element={<OAuthCallback />} />
          <Route path="/" element={isAuthenticated ? <Navigate to="/app" replace /> : <PublicFeed />} />
          <Route path="/public-reels" element={isAuthenticated ? <Navigate to="/app/reels" replace /> : <LazyPage><PublicReels /></LazyPage>} />
          <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/app" replace />} />
          <Route path="/app" element={<ProtectedApp isAuthenticated={isAuthenticated} user={user}><Layout /></ProtectedApp>}>
            <Route index element={<Feed />} />
            <Route path="reels" element={<LazyPage><Reels /></LazyPage>} />
            <Route path="connections" element={<LazyPage><Connections /></LazyPage>} />
            <Route path="discover" element={<Navigate to="/app/connections" replace />} />
            <Route path="profile" element={<LazyPage><Profile /></LazyPage>} />
            <Route path="profile/:profileId" element={<LazyPage><Profile /></LazyPage>} />
            <Route path="create-post" element={<LazyPage><CreatePost /></LazyPage>} />
            <Route path="messages" element={<LazyPage><MessageWS /></LazyPage>} />
            <Route path="messages/:chatId" element={<LazyPage><ChatBox /></LazyPage>} />
            <Route path="notifications" element={<LazyPage><Notifications /></LazyPage>} />
            <Route path="settings" element={<LazyPage><SettingsPage /></LazyPage>} />
          </Route>
        </Routes>
      </SocketProvider>
    </>
  );
};

export default App;
