import { kafkaConsumer } from "../configs/kafka.js";
import Chat from "../models/Chat.js";
import { saveMessage } from "../services/message.service.js";
import { onlineUsers } from "../sockets/index.js";
import MessageWS from "../models/MessageWS.js";

const buildUnreadChatsCount = (chats, userId) =>
  chats.filter((chat) => Number(chat.unreadCount?.[String(userId)] || 0) > 0).length;

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
        } catch {
          console.warn("Skipping invalid Kafka message");
          return;
        }

        if (!payload.senderId || !payload.chatId) {
          console.warn("Missing required fields, skipping");
          return;
        }

        const saved = await saveMessage(payload);
        if (!saved) return;

        io.to(saved.chatId.toString()).emit("new_message", saved);
        const chat = await Chat.findById(saved.chatId).lean();
        const recipients = chat?.isGroup
          ? (chat.participants || []).map((id) => String(id)).filter((id) => id !== String(saved.senderId))
          : [String(saved.receiverId)];

        recipients.forEach((recipientId) => {
          io.to(`user:${recipientId}`).emit("inbox_message", saved);
        });
        io.to(`user:${saved.senderId}`).emit("inbox_message", saved);

        for (const recipientId of recipients) {
          if (!onlineUsers.has(String(recipientId))) continue;

          const nextDeliveredTo = Array.from(new Set([...(saved.deliveredTo || []).map((id) => String(id)), String(recipientId)]));
          const nextStatus = chat?.isGroup
            ? "delivered"
            : nextDeliveredTo.includes(String(saved.receiverId))
              ? "delivered"
              : saved.status;

          await MessageWS.updateOne(
            { _id: saved._id },
            {
              $addToSet: { deliveredTo: recipientId },
              $set: { status: nextStatus },
            }
          );

          io.to(String(saved.chatId)).emit("message_status", {
            messageId: saved.messageId,
            deliveredTo: nextDeliveredTo,
            readBy: (saved.readBy || []).map((id) => String(id)),
            status: nextStatus,
          });
          io.to(`user:${saved.senderId}`).emit("message_delivered", {
            messageId: saved.messageId,
            deliveredTo: nextDeliveredTo,
            status: nextStatus,
          });

          const chats = await Chat.find({ participants: recipientId }).lean();
          const unreadChatsCount = buildUnreadChatsCount(chats, recipientId);
          io.to(`user:${recipientId}`).emit("unread_chats_count", { count: unreadChatsCount });
        }
      } catch (error) {
        console.error("Failed to process message", error);
      }
    },
  });

  process.on("SIGINT", async () => {
    await consumer.disconnect();
    process.exit(0);
  });
};
