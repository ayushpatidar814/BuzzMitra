import mongoose from "mongoose";
import Chat from "../models/Chat.js";
import MessageWS from "../models/MessageWS.js";
import imagekit from "../configs/imagekit.js";
import User from "../models/User.js";
import fs from 'fs/promises';

const uploadMedia = async (req, res) => {
  try {
    const { userId } = req.auth();

    let file = req.file;

    if(!file){
      return res.json({success: false, message: "Media can not be empty"})
    }

    const allowedMimeTypes = [
      'image/jpeg',
      'image/png', 
      'image/gif',
      'image/webp',
      'image/bmp'
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      fs.unlink(file.path, () => {});
      return res.status(400).json({ success: false, message: "Only image files are allowed" });
    }

    let media = null;

    if (file) {
      const buffer = await fs.readFile(file.path);

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
      .sort({ updatedAt: -1 })
      .lean();

    // extract other user ids
    const otherUserIds = chats.map(chat =>
      chat.participants.find(id => id !== userId)
    );

    // fetch user profiles
    const users = await User.find(
      { _id: { $in: otherUserIds } },
      "full_name username profile_picture"
    ).lean();

    // map users by id
    const userMap = {};
    users.forEach(u => {
      userMap[u._id] = u;
    });

    const unreadData = await MessageWS.aggregate([
      { $match: { receiverId: userId, status: { $ne: "read" } } },
      { $group: { _id: "$chatId", unreadMessages: { $sum: 1 } } }
    ]);

    const unreadMap = {};
    unreadData.forEach(u => {
      unreadMap[u._id.toString()] = u.unreadMessages;
    });

    const unreadChatsCount = unreadData.length;
    const totalUnreadMessages = unreadData.reduce(
      (acc, u) => acc + u.unreadMessages,
      0
    );

    // build final response
    const formattedChats = chats.map(chat => {
      const otherUserId = chat.participants.find(id => id !== userId);

      const clearedAt = chat.clearedBy?.find(
        c => c.userId === userId
      )?.clearedAt;

      let lastMessage = null;

      if (
        chat.lastMessage &&
        (!clearedAt || chat.lastMessage.createdAt > clearedAt)
      ) {
        lastMessage = {
          ...chat.lastMessage,
          status: chat.lastMessage.status || "sent",
        };
      }

      return {
        _id: chat._id,
        otherUser: userMap[otherUserId],
        lastMessage,
        unreadMessages: clearedAt ? 0 : unreadMap[chat._id.toString()] || 0,
        updatedAt: chat.updatedAt,
      };
    }).filter(chat => chat.lastMessage !== null);

    res.json({ success: true, data: formattedChats, unreadChatsCount, totalUnreadMessages, });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getMessages = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { chatId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.json({ success: false, message: "Invalid chatId" });
    }

    // fetch chat
    const chat = await Chat.findById(chatId).lean();
    if (!chat || !chat.participants.includes(userId)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const clearedAt = chat?.clearedBy?.find(
      c => c.userId === userId
    )?.clearedAt;

    const query = {
      chatId,
      ...(clearedAt && { createdAt: { $gt: clearedAt } })
    };

    const messages = await MessageWS
      .find(query)
      .sort({ createdAt: 1 })
      .limit(50)
      .lean();

    // find receiver id
    const receiverId = chat.participants.find(
      (id) => id.toString() !== userId
    );

    // fetch receiver profile
    const receiver = await User.findById(
      receiverId,
      "full_name username profile_picture"
    ).lean();

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

    const user = await User.findById(receiverId).select("fullName username avatar").lean();
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

const clearChatForMe = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { chatId } = req.params;
  
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid chatId",
        });
    }
  
    await Chat.updateOne(
      { _id: chatId },
      {
        $pull: { clearedBy: { userId } },
      }
    );

    await Chat.updateOne(
      { _id: chatId },
      {
        $push: {
          clearedBy: {
            userId,
            clearedAt: new Date(),
          },
        },
      }
    );
  
    res.status(200).json({ success: true });
  } catch (error) {
    console.log(error)
    res.json({success: false, message: error.message})
  }
};



export { uploadMedia, getChats, getMessages, getOrCreateChat, clearChatForMe }