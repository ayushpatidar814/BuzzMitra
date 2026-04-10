import { kafkaConsumer } from "../configs/kafka.js";
import Chat from "../models/Chat.js";
import { saveMessage } from "../services/message.service.js";
import { onlineUsers } from "../sockets/index.js";
import MessageWS from "../models/MessageWS.js";
import { emitBatched } from "../sockets/emitBatch.js";

const buildUnreadChatsCount = (chats, userId) =>
  chats.filter((chat) => Number(chat.unreadCount?.[String(userId)] || 0) > 0).length;

const buildUnreadCountMap = (chats, recipientIds) => {
  const recipients = new Set(recipientIds.map((id) => String(id)));
  const counts = new Map();

  chats.forEach((chat) => {
    (chat.participants || []).forEach((participantId) => {
      const normalizedId = String(participantId);
      if (!recipients.has(normalizedId)) return;
      if (Number(chat.unreadCount?.[normalizedId] || 0) <= 0) return;
      counts.set(normalizedId, (counts.get(normalizedId) || 0) + 1);
    });
  });

  return counts;
};

export const startConsumer = async (io) => {
  const consumer = kafkaConsumer("chat-consumer-group");

  await consumer.connect();
  await consumer.subscribe({ topic: "chat-messages", fromBeginning: false });

  await consumer.run({
    partitionsConsumedConcurrently: 3,
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
        const chat = await Chat.findById(saved.chatId)
          .select("participants isGroup unreadCount")
          .lean();
        const recipients = chat?.isGroup
          ? (chat.participants || []).map((id) => String(id)).filter((id) => id !== String(saved.senderId))
          : [String(saved.receiverId)];

        recipients.forEach((recipientId) => {
          emitBatched(io, `user:${recipientId}`, "inbox_message", saved);
        });
        emitBatched(io, `user:${saved.senderId}`, "inbox_message", saved);

        const onlineRecipients = recipients.filter((recipientId) => onlineUsers.has(String(recipientId)));
        if (onlineRecipients.length) {
          const nextDeliveredTo = Array.from(
            new Set([
              ...(saved.deliveredTo || []).map((id) => String(id)),
              ...onlineRecipients.map((id) => String(id)),
            ])
          );
          const readBy = (saved.readBy || []).map((id) => String(id));
          const nextStatus = chat?.isGroup
            ? "delivered"
            : nextDeliveredTo.includes(String(saved.receiverId))
              ? "delivered"
              : saved.status;

          const [recipientChats] = await Promise.all([
            Chat.find({ participants: { $in: onlineRecipients } })
              .select("participants unreadCount")
              .lean(),
            MessageWS.updateOne(
              { _id: saved._id },
              {
                $addToSet: { deliveredTo: { $each: onlineRecipients } },
                $set: { status: nextStatus },
              }
            ),
          ]);

          emitBatched(io, String(saved.chatId), "message_status", {
            messageId: saved.messageId,
            deliveredTo: nextDeliveredTo,
            readBy,
            status: nextStatus,
          });
          emitBatched(io, `user:${saved.senderId}`, "message_delivered", {
            messageId: saved.messageId,
            deliveredTo: nextDeliveredTo,
            status: nextStatus,
          });

          const unreadCountMap = buildUnreadCountMap(recipientChats, onlineRecipients);
          onlineRecipients.forEach((recipientId) => {
            emitBatched(io, `user:${recipientId}`, "unread_chats_count", {
              count: unreadCountMap.get(String(recipientId)) || 0,
            });
          });
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
