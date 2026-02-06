// sockets/chat.socket.js
import { sendMessageToKafka } from "../kafka/producer.js";

export const chatSocketHandler = (io, socket) => {

  // sockets/chat.socket.js
  socket.on("join_chat", (chatId) => {
    if (!chatId) return;
    socket.join(chatId); // ✅ join room for this chat
    console.log(`User ${socket.user.id} joined chat ${chatId}`);
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

      socket.emit("message_queued", { messageId: message.messageId });
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
};
