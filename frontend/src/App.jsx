import React, { useEffect, useRef } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import Feed from "./pages/Feed";
import Connections from "./pages/Connections";
import Discover from "./pages/Discover";
import Profile from "./pages/Profile";
import CreatePost from "./pages/CreatePost";
import Layout from "./pages/Layout";
import MessageWS from "./pages/messageWS/MessageWS";
import ChatBox from "./pages/messageWS/ChatBox";
import SocketProvider from "./socket/SocketProvider";
import { useAuth } from "@clerk/clerk-react";
import { Toaster } from "react-hot-toast";
import { useDispatch } from "react-redux";
import { fetchUser } from "./features/user/userSlice";
import { fetchConnections } from "./features/connections/connectionsSlice";

const App = () => {
  const { getToken, isSignedIn } = useAuth();
  const { pathname } = useLocation();
  const pathnameRef = useRef(pathname);
  const dispatch = useDispatch();


  useEffect(() => {
    if (!isSignedIn) return;

    const fetchData = async () => {
      const token = await getToken();
      dispatch(fetchUser(token));
      dispatch(fetchConnections(token));
    };
    fetchData();
  }, [isSignedIn, getToken, dispatch]);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  return (
    <>
      <Toaster />
      <SocketProvider>
        <Routes>
          <Route path="/" element={!isSignedIn ? <Login /> : <Layout />}>
            <Route index element={<Feed />} />
            <Route path="connections" element={<Connections />} />
            <Route path="discover" element={<Discover />} />
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