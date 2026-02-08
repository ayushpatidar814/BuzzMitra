import React, { useEffect, useRef } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import Feed from "./pages/Feed";
import Connections from "./pages/Connections";
import Discover from "./pages/Discover";
import Profile from "./pages/Profile";
import CreatePost from "./pages/CreatePost";
import { useAuth } from "@clerk/clerk-react";
import Layout from "./pages/Layout";
import { Toaster } from "react-hot-toast";
import { useDispatch } from "react-redux";
import { fetchUser } from "./features/user/userSlice";
import { fetchConnections } from "./features/connections/connectionsSlice";
// import { addMessage } from './features/messages/messagesSlice'
// import Notification from './components/Notification'
import MessageWS from "./pages/messageWS/MessageWS";
import ChatBox from "./pages/messageWS/ChatBox";
import SocketProvider from "./socket/SocketProvider";

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

  // useEffect(()=>{
  //   if(user){
  //     const eventSource = new EventSource(import.meta.env.VITE_BASEURL + '/api/message/' + user.id);
  //     eventSource.onmessage = (event)=>{
  //       const message = JSON.parse(event.data)

  //       if(pathnameRef.current === ('/messages/' + message.from_user_id._id)){
  //         dispatch(addMessage(message))
  //       } else{
  //         toast.custom((t)=>(
  //           <Notification t={t} message={message} />
  //         ), {position: 'bottom-right'})
  //       }
  //     }
  //     return ()=>{
  //       eventSource.close()
  //     }
  //   }
  // },[user, dispatch])

  return (
    <>
      <Toaster />
      <SocketProvider>
        <Routes>
          <Route path="/" element={!isSignedIn ? <Login /> : <Layout />}>
            <Route index element={<Feed />} />
            {/* <Route path='messages' element={<Message />} />
            <Route path='messages/:userId' element={<ChatBox />} /> */}
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