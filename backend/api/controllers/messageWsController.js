import mongoose from "mongoose";
import Chat from "../models/Chat.js";
import MessageWS from "../models/MessageWS.js";
import imagekit from "../configs/imagekit.js";
import User from "../models/User.js";
import fs from 'fs';

const uploadMedia = async (req, res) => {
  try {
    const { userId } = req.auth();

    let file = req.file;

    if(!file){
      return res.json({success: false, message: "Media can not be empty"})
    }

    let media = null;

    if (file) {
      const buffer = await fs.readFileSync(file.path);

      const uploadRes = await imagekit.upload({
        file: buffer,
        fileName: `${userId}-${Date.now()}-${file.originalname}`,
        folder: "chat-media",
      });

      if (!uploadRes?.url) {
        fs.unlink(file.path, () => {});
        return res.status(500).json({
          success: false,
          message: "Media upload failed",
        });
      }

      media = {
        url: uploadRes.url,
        thumbnail: uploadRes.thumbnailUrl || "",
        size: file.size,
        mimeType: file.mimetype,
      };

      fs.unlink(file.path, () => {});
    }
  
    res.status(200).json({
      success: true,
      media,
    });
  } catch (error) {
    console.log(error)
    res.json({success: false, message: error.message})
  }
};

const getChats = async (req, res) => {
  try {
    const { userId } = req.auth();

    const chats = await Chat.find({
      participants: userId,
      isGroup: false,
    })
      .populate("lastMessage")
      .sort({ updatedAt: -1 });

    // extract other user ids
    const otherUserIds = chats.map(chat =>
      chat.participants.find(id => id !== userId)
    );

    // fetch user profiles
    const users = await User.find(
      { _id: { $in: otherUserIds } },
      "full_name username profile_picture"
    );

    // map users by id
    const userMap = {};
    users.forEach(u => {
      userMap[u._id] = u;
    });

    // build final response
    const formattedChats = chats.map(chat => {
      const otherUserId = chat.participants.find(id => id !== userId);

      return {
        _id: chat._id,
        otherUser: userMap[otherUserId],
        lastMessage: chat.lastMessage,
        updatedAt: chat.updatedAt,
      };
    });

    res.json({ success: true, data: formattedChats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.auth();

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.json({ success: false, message: "Invalid chatId" });
    }

    // fetch chat
    const chat = await Chat.findById(chatId);
    if (!chat || !chat.participants.includes(userId)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // find receiver id
    const receiverId = chat.participants.find(
      (id) => id.toString() !== userId
    );

    // fetch receiver profile
    const receiver = await User.findById(
      receiverId,
      "full_name username profile_picture"
    );

    // fetch messages
    const messages = await MessageWS.find({
      chatId,
      deletedAt: null,
    })
      .sort({ createdAt: 1 }) // oldest → newest (better for UI)
      .limit(50);

    res.json({
      success: true,
      data: {
        receiver,
        messages,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
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

    if (!receiverId) {
      return res.json({ success: false, message: "Receiver Id is required" });
    }

    if (userId === receiverId) {
      return res.json({ success: false, message: "Cannot chat with yourself" });
    }

    const user = await User.findById(receiverId).select("fullName username avatar")
    const participants = [userId, receiverId].sort();

    // 1️⃣ Try to find existing chat
    let chat = await Chat.findOne({
      isGroup: false,
      participants,

    });

    // 2️⃣ If not found, create new chat
    if (!chat) {
      chat = await Chat.create({
        participants,
        isGroup: false,
        user,
      });
    }

    res.json({ success: true, data: chat });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


export { uploadMedia, getChats, getMessages, deleteMessage, markAsRead, editMessage, sendTyping, getOrCreateChat }