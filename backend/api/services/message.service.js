import Chat from "../models/Chat.js";
import MessageWS from "../models/MessageWS.js";

export const saveMessage = async (data) => {
  // 🛑 Idempotency guard
  const exists = await MessageWS.findOne({ messageId: data.messageId });
  if (exists) return exists;

  const participants = [data.senderId, data.receiverId].sort();

  const chat = await Chat.findOneAndUpdate(
    { participants },
    { $setOnInsert: { participants } },
    { new: true, upsert: true }
  );

  const message = await MessageWS.create({
    ...data,
    chatId: chat._id
  });

  await Chat.findByIdAndUpdate(chat._id, {
    lastMessage: message._id
  });

  return message;
};
