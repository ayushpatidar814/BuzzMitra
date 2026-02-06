import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/clerk-react";
import { socket } from "../socket/socket.js";

export const useSocket = () => {
  const { isSignedIn, getToken, isLoaded } = useAuth();
  const connectedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (connectedRef.current) return;

    const connect = async () => {
      const token = await getToken();

      socket.auth = { token };
      socket.connect();

      connectedRef.current = true;

      socket.on("connect", () =>
        console.log("✅ socket connected", socket.id)
      );

      socket.on("connect_error", (err) =>
        console.error("❌ socket error", err.message)
      );
    };

    connect();

    return () => {
      socket.disconnect();
      connectedRef.current = false;
    };
  }, [isLoaded, isSignedIn, getToken]);

  return socket;
};

