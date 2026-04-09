import User from "../models/User.js";
import { onlineUsers } from "./index.js";

export const presenceSocket = (io, socket) => {
  const userId = socket.user.id;

  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }

  onlineUsers.get(userId).add(socket.id);
  User.updateOne({ _id: userId }, { $set: { isOnline: true } }).catch(() => {});
  io.emit("user:online", { userId });

  socket.on("disconnect", () => {
    const userSockets = onlineUsers.get(userId);
    if (!userSockets) return;

    userSockets.delete(socket.id);
    if (userSockets.size === 0) {
      onlineUsers.delete(userId);
      User.updateOne({ _id: userId }, { $set: { isOnline: false } }).catch(() => {});
      io.emit("user:offline", { userId });
    }
  });

  socket.on("presence:get", () => {
    socket.emit("presence:list", Array.from(onlineUsers.keys()));
  });
};
