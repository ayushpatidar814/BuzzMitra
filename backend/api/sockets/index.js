import { Server } from "socket.io";
import { socketAuthMiddleware } from "./auth.socket.js";
import { presenceSocket } from "./presence.socket.js";
import { chatSocketHandler } from "./chat.socket.js"; // (next step)

export const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      credentials: true,
    },
  });

  // 🔐 Auth middleware
  socketAuthMiddleware(io);

  io.on("connection", (socket) => {
    console.log("🔌 User connected:", socket.user.id);

    // 👤 Presence
    presenceSocket(io, socket);

    // 💬 Chat (already planned)
    chatSocketHandler(io, socket);
  });

  return io;
};
