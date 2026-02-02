import mongoose from "mongoose";
import Chat from "../models/Chat.js";
import MessageWS from "../models/MessageWS.js";
import { sendMessageToKafka } from "../kafka/producer.js";
import { generateSnowflakeId } from '../utils/snowflake.js'
import imagekit from "../configs/imagekit.js";

const sendMessage = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { receiverId, text = "" } = req.body;
  
    if(!receiverId || receiverId === userId){
      return res.json({success: false, message: "Invalid Receiver"})
    }

    if(!text && !req.file){
      return res.json({success: false, message: "Message can not be empty"})
    }

    let media = null;

    if(req.file){
      const uploadRes = await imagekit.upload({
        file: req.file.buffer,
        fileName: `${userId}-${Date.now()}`,
        folder: "chat-media",
      });

      media = {
        url: uploadRes.url,
        thumbnail: uploadRes.thumbnailUrl || "",
        size: req.file.size,
        mimeType: req.file.mimeType,
      };
    }

    const message = {
      messageId: generateSnowflakeId(),
      senderId: userId,
      receiverId,
      text,
      type: media ? 'media' : 'text',
      media,
    };
  
    await sendMessageToKafka(message);
  
    res.status(200).json({ success: true, message: "Message sent" });
  } catch (error) {
    console.log(error)
    res.json({success: false, message: error.message})
  }
};

const getChats = async (req, res) => {
  try {
    const { userId } = req.auth();

    const chats = await Chat.find({ participants: userId }).populate("lastMessage").sort({ updatedAt: -1 });

    res.json({ success: true, data: chats || [] });
  } catch (error) {
    console.log(error)
    res.json({success: false, message: error.message})
  }
};

const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.auth();

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.json({ success: false, message: "Invalid chatId" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.participants.includes(userId)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const messages = await MessageWS.find({ chatId, deletedAt: null }).sort({ createdAt: -1 }).limit(50);
  
    res.json({ success: true, data: messages });
  } catch (error) {
    console.log(error)
    res.json({success: false, message: error.message})
  }
};

const deleteMessage = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { messageId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.json({ success: false, message: "Invalid messageId" });
    }

    const message = await MessageWS.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    if (message.senderId !== userId) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    if (message.deletedAt) {
      return res.json({ success: true });
    }

    message.deletedAt = new Date();
    message.text = "";
    message.mediaUrl = "";

    await message.save();

    res.json({ success: true, message: "Message deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const editMessage = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { messageId } = req.params;
    const { text } = req.body;

    if (!text?.trim()) {
      return res.json({ success: false, message: "Text required" });
    }

    const message = await MessageWS.findById(messageId);

    if (!message || message.deletedAt) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    if (message.senderId !== userId) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    // Optional: 60-minute edit limit
    const SIXTY_MIN = 60 * 60 * 1000;
    if (Date.now() - message.createdAt > SIXTY_MIN) {
      return res.status(400).json({ success: false, message: "Edit window expired" });
    }
    
    message.text = text;
    message.editedAt = new Date();
    await message.save();
    
    res.json({ success: true, message: "Message edited" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const markAsRead = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { chatId } = req.params;

    const messages = await MessageWS.find({
      chatId, 
      senderId: { $ne: userId},
    }).select("_id")

    const messageIds = messages.map(m => m.messageId)

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.participants.includes(userId)) {
      return res.status(403).json({ success: false });
    }

    await MessageStatus.updateMany(
      { messageId: { $in: messageIds }, userId },
      { $set: { status: "read" } }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const sendTyping = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { chatId, isTyping } = req.body;

    if(!chatId){
      return res.json({success: false, message: "Chat Id is required."})
    }

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.participants.includes(userId)) {
      return res.json({ success: false });
    }

    // emit via socket.io 
    req.io.to(chatId).emit("user-typing", {
      chatId,
      userId,
      isTyping: Boolean(isTyping)
    });
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const getOrCreateChat = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { receiverId } = req.body;

    if(!receiverId){
      return res.json({success: false, message: "Receiver Id is required"})
    }

    if(userId === receiverId){
      return res.json({success: false, message: "Send message to friends"})
    }

    const chat = await Chat.findOneAndUpdate(
      {
        isGroup: false,
        participants: { $all: [userId, receiverId] },
      },
      {
        $setOnInsert: {
          participants: [userId, receiverId],
          isGroup: false,
        },
      },
      { new: true, upsert: true }
    );

    res.json({ success: true, data: chat });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export { sendMessage, getChats, getMessages, deleteMessage, markAsRead, editMessage, sendTyping, getOrCreateChat }