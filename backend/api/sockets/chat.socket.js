import Chat from "../models/Chat.js";
import MessageWS from "../models/MessageWS.js";
import { onlineUsers } from "./index.js";
import { sendMessageToKafka } from "../kafka/producer.js";

const emitDeliveredUpdates = async (io, userId) => {
  const undeliveredMessages = await MessageWS.find({
    senderId: { $ne: userId },
    deliveredTo: { $ne: userId },
  });

  if (!undeliveredMessages.length) return;

  await Promise.all(
    undeliveredMessages.map(async (message) => {
      const deliveredTo = Array.from(new Set([...(message.deliveredTo || []).map((id) => String(id)), String(userId)]));
      const chat = await Chat.findById(message.chatId).lean();
      const receivers = chat?.isGroup
        ? (chat.participants || []).map((id) => String(id)).filter((id) => id !== String(message.senderId))
        : [String(message.receiverId)];
      const readBy = (message.readBy || []).map((id) => String(id));
      const nextStatus = receivers.length > 0 && receivers.every((id) => readBy.includes(id))
        ? "read"
        : receivers.length > 0 && receivers.every((id) => deliveredTo.includes(id))
          ? "delivered"
          : "sent";

      await MessageWS.updateOne(
        { _id: message._id },
        {
          $addToSet: { deliveredTo: userId },
          $set: { status: nextStatus },
        }
      );

      io.to(String(message.chatId)).emit("message_status", {
        messageId: message.messageId,
        deliveredTo,
        readBy,
        status: nextStatus,
      });
      io.to(`user:${message.senderId}`).emit("message_delivered", {
        messageId: message.messageId,
        deliveredTo,
        status: nextStatus,
      });
    })
  );
};

export const chatSocketHandler = (io, socket) => {
  socket.on("join_user", async (userId) => {
    if (!userId) return;

    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }

    onlineUsers.get(userId).add(socket.id);
    socket.join(`user:${userId}`);

    const chats = await Chat.find({ participants: userId }).lean();
    const unreadChatsCount = chats.filter((chat) => Number(chat.unreadCount?.[String(userId)] || 0) > 0).length;
    io.to(`user:${userId}`).emit("unread_chats_count", { count: unreadChatsCount });
    await emitDeliveredUpdates(io, userId);
  });

  socket.on("join_chat", async (chatId) => {
    if (!chatId) return;
    socket.join(chatId);

    const undeliveredMessages = await MessageWS.find({
      chatId,
      senderId: { $ne: socket.user.id },
      deliveredTo: { $ne: socket.user.id },
    });

    if (undeliveredMessages.length > 0) {
      for (const message of undeliveredMessages) {
        const chat = await Chat.findById(message.chatId).lean();
        const receivers = chat?.isGroup
          ? (chat.participants || []).map((id) => String(id)).filter((id) => id !== String(message.senderId))
          : [String(message.receiverId)];
        const deliveredTo = Array.from(new Set([...(message.deliveredTo || []).map((id) => String(id)), String(socket.user.id)]));
        const readBy = (message.readBy || []).map((id) => String(id));
        const nextStatus = receivers.length > 0 && receivers.every((id) => readBy.includes(id))
          ? "read"
          : receivers.length > 0 && receivers.every((id) => deliveredTo.includes(id))
            ? "delivered"
            : "sent";

        await MessageWS.updateOne({ _id: message._id }, { $addToSet: { deliveredTo: socket.user.id }, $set: { status: nextStatus } });
        io.to(chatId).emit("message_status", {
          messageId: message.messageId,
          deliveredTo,
          readBy,
          status: nextStatus,
        });
        io.to(`user:${message.senderId}`).emit("message_delivered", {
          messageId: message.messageId,
          deliveredTo,
          status: nextStatus,
        });
      }
    }
  });

  socket.on("send_message", async (payload) => {
    try {
      if (!payload.chatId || !payload.messageId) return;

      const message = {
        ...payload,
        senderId: socket.user.id,
        createdAt: new Date().toISOString(),
      };

      await sendMessageToKafka(message);
    } catch (error) {
      console.error(error);
      socket.emit("socket:error", { message: error.message });
    }
  });

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
    await MessageWS.updateOne({ messageId }, { $set: { text, edited: true } });
    io.to(chatId).emit("message_edited", { messageId, text, edited: true });
  });

  socket.on("read_messages", async ({ chatId }) => {
    if (!chatId) return;

    const chat = await Chat.findById(chatId).lean();
    if (!chat) return;

    await MessageWS.updateMany(
      { chatId, senderId: { $ne: socket.user.id } },
      {
        $addToSet: { deliveredTo: socket.user.id, readBy: socket.user.id },
        $set: { status: chat.isGroup ? "read" : "read" },
      }
    );
    await Chat.updateOne({ _id: chatId }, { $set: { [`unreadCount.${socket.user.id}`]: 0 } });

    const chats = await Chat.find({ participants: socket.user.id }).lean();
    const unreadChatsCount = chats.filter((chat) => Number(chat.unreadCount?.[String(socket.user.id)] || 0) > 0).length;

    io.to(`user:${socket.user.id}`).emit("unread_chats_count", { count: unreadChatsCount });

    const readMessages = await MessageWS.find({
      chatId,
      senderId: { $ne: socket.user.id },
    }).select("messageId senderId deliveredTo readBy status");

    readMessages.forEach((message) => {
      io.to(`user:${message.senderId}`).emit("message_read", {
        messageId: message.messageId,
        deliveredTo: (message.deliveredTo || []).map((id) => String(id)),
        readBy: (message.readBy || []).map((id) => String(id)),
        status: message.status,
      });
      io.to(chatId).emit("message_status", {
        messageId: message.messageId,
        deliveredTo: (message.deliveredTo || []).map((id) => String(id)),
        readBy: (message.readBy || []).map((id) => String(id)),
        status: message.status,
      });
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
    }
  });
};
