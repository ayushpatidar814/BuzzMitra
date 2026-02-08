import { kafkaConsumer } from "../configs/kafka.js";
import MessageWS from "../models/MessageWS.js";
import { saveMessage } from "../services/message.service.js";
import { onlineUsers } from "../sockets/index.js";

export const startConsumer = async (io) => {
  const consumer = kafkaConsumer("chat-consumer-group");

  await consumer.connect();
  await consumer.subscribe({ topic: "chat-messages", fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        let payload;

        try {
          payload = JSON.parse(message.value.toString());
        } catch (err) {
          console.warn("⚠️ Skipping invalid Kafka message");
          return;
        }

        if (!payload.senderId || !payload.receiverId) {
          console.warn("⚠️ Missing required fields, skipping");
          return;
        }
        
        const saved = await saveMessage(payload);
        if(!saved) return;
        
        // ChatBox (open chat)
        io.to(saved.chatId.toString()).emit("new_message", saved);

        // MessageWS (chat list)
        io.to(`user:${saved.receiverId}`).emit("inbox_message", saved);
        io.to(`user:${saved.senderId}`).emit("inbox_message", saved);
        
        const receiverSocketId = onlineUsers.get(saved.receiverId); // Clerk ID
        if (receiverSocketId) {
          // update DB
          await MessageWS.updateOne(
            { messageId: saved.messageId },
            { $set: { status: "delivered" } }
          );
          
          // notify sender ONLY
          io.to(`user:${saved.senderId}`).emit("message_delivered", {
            messageId: saved.messageId,
          });

          // 🔔 Emit unread chats count to receiver
          const unreadChatsCount = await MessageWS.distinct("chatId", {
            receiverId: saved.receiverId,
            status: { $ne: "read" },
          }).then(chats => chats.length);

          io.to(`user:${saved.receiverId}`).emit("unread_chats_count", {
            count: unreadChatsCount,
          });
        }
        
      } catch (error) {
        console.error("❌ Failed to process message", error);
      }
    },
  });

  console.log("📥 Kafka Consumer running");

  process.on("SIGINT", async () => {
    await consumer.disconnect();
    process.exit(0);
  });
};
