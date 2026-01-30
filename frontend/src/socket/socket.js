import { io } from "socket.io-client";
import { store } from "../app/store.js";
import { addMessage } from "../features/messages/chatSlice.js";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ["websocket"],
});

export const connectSocket = (token) => {
  socket.auth = { token };
  socket.connect();

  socket.on("message:new", (message) => {
    store.dispatch(addMessage(message));
  });
};

export const disconnectSocket = () => {
  socket.disconnect();
};
