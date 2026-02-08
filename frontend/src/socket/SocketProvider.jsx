import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useDispatch } from "react-redux";
import { socket } from "./socket";
import {
  incrementUnread,
  resetAllUnread,
} from "../features/messagesWS/chatCountSlice";

const SocketProvider = ({ children }) => {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();
  const dispatch = useDispatch();

  const connectedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    if (connectedRef.current) return;

    const connect = async () => {
      const token = await getToken();
      socket.auth = { token };
      socket.connect();

      socket.on("connect", () => {
        socket.emit("join_user", user.id);
        console.log("✅ socket connected", socket.id);
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

      connectedRef.current = true;
    };

    connect();

    return () => {
      socket.off("inbox_message");
      socket.disconnect();
      dispatch(resetAllUnread());
      connectedRef.current = false;
    };
  }, [isLoaded, isSignedIn, user, getToken, dispatch]);

  return children;
};

export default SocketProvider;
