import { Server } from "socket.io";
import { socketAuthMiddleware } from "./auth.socket.js";
import { presenceSocket } from "./presence.socket.js";
import { chatSocketHandler } from "./chat.socket.js"; // (next step)

let io;

export const onlineUsers = new Map(); // userId → socketId

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: [
        "http://localhost:5173",
        "https://buzzmitra.vercel.app",
      ],
      credentials: true,
    },
  });

  // 🔐 Auth middleware
  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    const userId = socket.user.id;
    console.log("🔌 User connected:", userId);

    // Join user-specific room
    socket.join(userId);

    presenceSocket(io, socket);
    chatSocketHandler(io, socket);
  });

  return io;
};

export const getIO = () => io;