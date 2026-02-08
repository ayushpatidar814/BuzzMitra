// sockets/chat.socket.js
import { sendMessageToKafka } from "../kafka/producer.js";
import MessageWS from '../models/MessageWS.js';
import { onlineUsers } from "./index.js";

export const chatSocketHandler = (io, socket) => {

  /* ---------------- USER ROOM ---------------- */
  socket.on("join_user", async (userId) => {
    if (!userId) return;
    
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }

    onlineUsers.get(userId).add(socket.id);
    
    socket.join(`user:${userId}`);
    console.log(`👤 User ${userId} joined user room`);

    // ✅ SEND INITIAL UNREAD CHAT COUNT
    const unreadChatsCount = await MessageWS.distinct("chatId", {
      receiverId: userId,
      status: { $ne: "read" },
    }).then(chats => chats.length);

    io.to(`user:${userId}`).emit("unread_chats_count", {
      count: unreadChatsCount,
    });
  });

  /* ---------------- CHAT ROOM ---------------- */
  socket.on("join_chat", async (chatId) => {
    if (!chatId) return;
    socket.join(chatId); // ✅ join room for this chat

    console.log(`User ${socket.user.id} joined chat ${chatId}`);

    // 🔹 Mark undelivered messages as delivered
  const undeliveredMessages = await MessageWS.find({
    chatId,
    receiverId: socket.user.id, // messages sent TO this user
    status: "sent",
  });

  if (undeliveredMessages.length > 0) {
    const messageIds = undeliveredMessages.map(m => m.messageId);

    // Update DB
    await MessageWS.updateMany(
      { messageId: { $in: messageIds } },
      { $set: { status: "delivered" } }
    );

    // Notify the senders
    undeliveredMessages.forEach(msg => {
      io.to(`user:${msg.senderId}`).emit("message_delivered", {
        messageId: msg.messageId,
      });
    });

    console.log(
      `Marked ${messageIds.length} messages as delivered for chat ${chatId}`
    );
  }
  });

  socket.on("send_message", async (payload) => {
    try {
      if (!payload.chatId || !payload.messageId || !payload.receiverId) return;

      const message = {
        ...payload,
        senderId: socket.user.id,
        createdAt: new Date().toISOString(),
      };

      await sendMessageToKafka(message);

    } catch (err) {
      console.error(err);
      socket.emit("socket:error", { message: err.message });
    }
  });

  // Typing indicator
  socket.on("typing", ({ chatId, isTyping }) => {
    socket.to(chatId).emit("typing", {
      chatId,
      userId: socket.user.id,
      isTyping,
    });
  });

  socket.on("delete_message", async ({ chatId, messageId }) => {
    await MessageWS.deleteOne({ messageId });

    io.to(chatId).emit("message_deleted", { messageId });
  });

  socket.on("edit_message", async ({ chatId, messageId, text }) => {
    await MessageWS.updateOne(
      { messageId },
      { $set: { text, edited: true } }
    );

    io.to(chatId).emit("message_edited", { messageId, text });
  });

  socket.on("read_messages", async ({ chatId }) => {
    if (!chatId) return;

    const messages = await MessageWS.find({
      chatId,
      receiverId: socket.user.id,
      status: { $ne: "read" }
    });

    await MessageWS.updateMany(
      { _id: { $in: messages.map(m => m._id) } },
      { status: "read" }
    );

    messages.forEach(m => {
      io.to(`user:${m.senderId}`).emit("message_read", {
        messageId: m.messageId
      });
    });

    // 🔄 update unread chat count
    const unreadChatsCount = await MessageWS.distinct("chatId", {
      receiverId: socket.user.id,
      status: { $ne: "read" },
    }).then(chats => chats.length);

    io.to(`user:${socket.user.id}`).emit("unread_chats_count", {
      count: unreadChatsCount,
    });
    
  });

  socket.on("chat:cleared", ({ chatId, userId }) => {
    socket.to(chatId).emit("chat:cleared", {
      chatId,
      userId
    });
  });


  socket.on("disconnect", () => {
  const userId = socket.user?.id;
  if (!userId) return;

  const sockets = onlineUsers.get(userId);
  if (!sockets) return;

  sockets.delete(socket.id);

  if (sockets.size === 0) {
    onlineUsers.delete(userId);
    console.log(`👤 ${userId} fully offline`);
  } else {
    console.log(`👤 ${userId} socket closed, ${sockets.size} remaining`);
  }
});



};
