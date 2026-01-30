/**
 * In-memory presence store
 * (Replace with Redis in production)
 */
const onlineUsers = new Map(); // userId -> Set(socketIds)

/**
 * Presence socket handlers
 */
export const presenceSocket = (io, socket) => {
  const userId = socket.user.id;

  // 🔌 User connected
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }

  onlineUsers.get(userId).add(socket.id);

  // Broadcast online status
  io.emit("user:online", { userId });

  // 📡 Handle disconnect
  socket.on("disconnect", () => {
    const userSockets = onlineUsers.get(userId);

    if (!userSockets) return;

    userSockets.delete(socket.id);

    // If no active sockets → offline
    if (userSockets.size === 0) {
      onlineUsers.delete(userId);
      io.emit("user:offline", { userId });
    }
  });

  /**
   * Optional: client asks for online users
   */
  socket.on("presence:get", () => {
    socket.emit(
      "presence:list",
      Array.from(onlineUsers.keys())
    );
  });
};
