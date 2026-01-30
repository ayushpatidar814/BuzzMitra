import { sendMessageToKafka } from "../kafka/producer.js";
import Chat from "../models/Chat.js";
import MessageWS from "../models/MessageWS.js";
import { generateSnowflakeId } from '../utils/snowflake.js'

const sendMessage = async (req, res) => {
  try {
    const senderId = req.auth.userId;
    const { receiverId, text } = req.body;
  
    let mediaUrl = req.body.mediaUrl || "";
    let mediaType = mediaUrl ? "media" : "text";
  
    const message = {
      messageId: generateSnowflakeId(),
      senderId,
      receiverId,
      text : text || "",
      mediaUrl,
      mediaType
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
    
    if(!chats){
      return res.json({success: false, message: "No chats found..."})
    }

    res.json({ success: true, data: chats });
  } catch (error) {
    console.log(error)
    res.json({success: false, message: error.message})
  }
};

const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.auth();

    const messages = await MessageWS.find({ chatId }).sort({ createdAt: -1 }).limit(50);
  
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

    const message = await MessageWS.findById(messageId);

    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    if (message.senderId !== userId) {
      return res.status(403).json({ success: false, message: "Not allowed" });
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

const markAsRead = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { chatId } = req.params;

    await MessageWS.updateMany(
      {
        chatId,
        receiverId: userId,
        readAt: null,
      },
      {
        $set: { readAt: new Date() },
      }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const editMessage = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { messageId } = req.params;
    const { text } = req.body;

    const message = await MessageWS.findById(messageId);

    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    if (message.senderId !== userId) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    // Optional: 15-minute edit limit
    const FIFTEEN_MIN = 15 * 60 * 1000;
    if (Date.now() - message.createdAt > FIFTEEN_MIN) {
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

const sendTyping = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { chatId } = req.body;

    // emit via websocket / redis pubsub
    // NOT stored in DB

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const getOrCreateChat = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { otherUserId } = req.body;

    let chat = await Chat.findOne({
      participants: { $all: [userId, otherUserId] },
      isGroup: false,
    });

    if (!chat) {
      chat = await Chat.create({
        participants: [userId, otherUserId],
        isGroup: false,
      });
    }

    res.json({ success: true, data: chat });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export { sendMessage, getChats, getMessages, deleteMessage, markAsRead, editMessage, sendTyping, getOrCreateChat }