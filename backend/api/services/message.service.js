import Chat from "../models/Chat.js";
import MessageWS from "../models/MessageWS.js";
import { onlineUsers } from "../sockets/index.js";

export const saveMessage = async (data) => {
  const exists = await MessageWS.findOne({ messageId: data.messageId });
  if (exists) return exists;

  let chat = null;
  if (data.chatId) {
    chat = await Chat.findById(data.chatId);
  }

  if (!chat) {
    const participants = [String(data.senderId), String(data.receiverId)].sort();
    chat = await Chat.findOneAndUpdate(
      { participants, isGroup: false },
      { $setOnInsert: { participants, isGroup: false }, $set: { updatedAt: new Date() } },
      { new: true, upsert: true }
    );
  }

  const participantIds = (chat.participants || []).map((id) => String(id));
  const senderId = String(data.senderId);
  const receivers = chat.isGroup
    ? participantIds.filter((id) => id !== senderId)
    : [String(data.receiverId)];

  const deliveredTo = [senderId, ...receivers.filter((id) => onlineUsers.has(String(id)))];
  const readBy = [senderId];
  const isFullyRead = receivers.length > 0 && receivers.every((id) => readBy.includes(String(id)));
  const isFullyDelivered = receivers.length > 0 && receivers.every((id) => deliveredTo.includes(String(id)));

  const message = await MessageWS.create({
    ...data,
    chatId: chat._id,
    receiverId: chat.isGroup ? null : data.receiverId,
    deliveredTo,
    readBy,
    status: isFullyRead ? "read" : isFullyDelivered ? "delivered" : "sent",
  });

  const unreadIncrements = receivers.reduce((acc, userId) => {
    acc[`unreadCount.${userId}`] = 1;
    return acc;
  }, {});

  await Chat.updateOne(
    { _id: chat._id },
    {
      ...(receivers.length ? { $inc: unreadIncrements } : {}),
      $set: { lastMessage: message._id, updatedAt: new Date(message.createdAt) },
    }
  );

  return message;
};
