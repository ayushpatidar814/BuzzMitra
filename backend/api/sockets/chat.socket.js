import { kafkaProducer } from "../configs/kafka.js";

export const chatSocketHandler = (io, socket) => {

  socket.on("send_message", async (payload) => {
    try {
      /*
        payload = {
          chatId,
          type,
          text?,
          media?,
          messageId
        }
      */
  
      if (!payload.chatId || !payload.messageId) {
        throw new Error("Invalid payload");
      }
  
      const message = {
        ...payload,
        sender: socket.userId,
        createdAt: Date.now()
      };
  
      // 🚀 Push to Kafka (NOT DB)
      await kafkaProducer.send({
        topic: "chat-messages",
        messages: [
          {
            key: payload.chatId,
            value: JSON.stringify(message)
          }
        ]
      });
  
      // ⚡ Optional: instant ACK to sender
      socket.emit("message_queued", {
        messageId: payload.messageId
      });
    } catch (error) {
      socket.emit("socket:error", {
        message: error.message
      })
    }
  });
};
