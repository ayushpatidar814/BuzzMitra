import { useEffect } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useDispatch } from "react-redux";
import { socket } from "./socket";
import { incrementUnread, resetAllUnread, } from "../features/messagesWS/chatCountSlice";

const SocketProvider = ({ children }) => {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();
  const dispatch = useDispatch();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    const connect = async () => {
      const token = await getToken();
      socket.auth = { token };
      socket.connect();
      
      socket.on("connect", () => {
        socket.emit("join_user", user.id);
      });

      /* 🔔 INBOX MESSAGE → redux only */
      socket.on("inbox_message", (message) => {
        if (message.receiverId === user.id) {
          dispatch(incrementUnread(message.chatId));
        }
      });

      socket.on("connect_error", (err) =>
        console.error("❌ socket error", err.message)
      );

    };

    connect();

    return () => {
      socket.off("inbox_message");
      socket.disconnect();
      dispatch(resetAllUnread());
    };
  }, [isLoaded, isSignedIn, user, getToken, dispatch]);

  return children;
};

export default SocketProvider;
