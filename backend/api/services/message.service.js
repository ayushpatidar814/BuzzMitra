import Chat from "../models/Chat.js";
import MessageWS from "../models/MessageWS.js";
import { onlineUsers } from "../sockets/index.js";
import { deleteCacheByPrefix } from "../utils/cache.js";
import { createBulkNotifications, createNotification } from "./notification.service.js";

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

  let message;
  try {
    message = await MessageWS.create({
      ...data,
      chatId: chat._id,
      receiverId: chat.isGroup ? null : data.receiverId,
      deliveredTo,
      readBy,
      status: isFullyRead ? "read" : isFullyDelivered ? "delivered" : "sent",
    });
  } catch (error) {
    if (error?.code === 11000) {
      return MessageWS.findOne({ messageId: data.messageId });
    }
    throw error;
  }

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

  await deleteCacheByPrefix(
    ...participantIds.map((id) => `cache:chats:${String(id)}`),
    `cache:chat-messages:${String(chat._id)}`
  );

  if (!data.suppressNotification) {
    if (chat.isGroup) {
      await createBulkNotifications(
        receivers.map((recipientId) => ({
          recipientId,
          actorId: senderId,
          type: "message",
          title: chat.groupName ? `New message in ${chat.groupName}` : "New group message",
          text: data.text || (data.media ? "Sent a photo" : "Sent a message"),
          link: `/app/messages/${chat._id}`,
          entityType: "chat",
          entityId: chat._id,
          meta: { chatId: String(chat._id), isGroup: true },
        }))
      );
    } else if (data.receiverId) {
      await createNotification({
        recipientId: data.receiverId,
        actorId: senderId,
        type: "message",
        title: "New message",
        text: data.text || (data.media ? "Sent a photo" : "Sent a message"),
        link: `/app/messages/${chat._id}`,
        entityType: "chat",
        entityId: chat._id,
        meta: { chatId: String(chat._id), isGroup: false },
      });
    }
  }

  return message;
};
