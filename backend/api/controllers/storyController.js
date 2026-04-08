import fs from "fs";
import crypto from "crypto";
import imagekit from "../configs/imagekit.js";
import Follow from "../models/Follow.js";
import Story from "../models/Story.js";
import StoryView from "../models/StoryView.js";
import { saveMessage } from "../services/message.service.js";
import { getIO, onlineUsers } from "../sockets/index.js";
import Chat from "../models/Chat.js";

const getAccessibleStory = async (storyId, userId) => {
  const story = await Story.findOne({
    _id: storyId,
    expires_at: { $gt: new Date() },
  }).populate("user", "full_name username profile_picture");

  if (!story) return null;

  if (String(story.user._id) === String(userId)) {
    return story;
  }

  const followsUploader = await Follow.exists({
    followerId: userId,
    followingId: story.user._id,
  });

  return followsUploader ? story : null;
};

const emitChatUpdates = async (message) => {
  const io = getIO();
  if (!io) return;

  io.to(message.chatId.toString()).emit("new_message", message);
  io.to(`user:${message.receiverId}`).emit("inbox_message", message);
  io.to(`user:${message.senderId}`).emit("inbox_message", message);

  if (onlineUsers.has(String(message.receiverId))) {
    const chats = await Chat.find({ participants: message.receiverId }).lean();
    const unreadChatsCount = chats.filter((chat) => Number(chat.unreadCount?.[String(message.receiverId)] || 0) > 0).length;
    io.to(`user:${message.receiverId}`).emit("unread_chats_count", { count: unreadChatsCount });
  }
};

const uploadStoryMedia = async (media) => {
  const fileBuffer = fs.readFileSync(media.path);
  const response = await imagekit.upload({
    file: fileBuffer,
    fileName: media.originalname,
    folder: "stories",
  });
  return response.url;
};

export const addUserStory = async (req, res) => {
  try {
    const { content = "", media_type, background_color = "#111827", duration_ms = 8000 } = req.body;
    const media = req.file;

    let media_url = "";
    if ((media_type === "image" || media_type === "video") && media) {
      media_url = await uploadStoryMedia(media);
    }

    const story = await Story.create({
      user: req.userId,
      content,
      media_url,
      media_type,
      background_color,
      duration_ms: Number(duration_ms || 8000),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    return res.json({ success: true, story: await story.populate("user"), message: "Story created successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getStories = async (req, res) => {
  try {
    const followingEdges = await Follow.find({ followerId: req.userId }).select("followingId").lean();
    const userIds = [req.userId, ...followingEdges.map((edge) => edge.followingId)];

    const stories = await Story.find({
      user: { $in: userIds },
      expires_at: { $gt: new Date() },
    })
      .populate("user")
      .sort({ createdAt: -1 });

    const groupedStories = [];
    const storyGroups = new Map();

    stories.forEach((story) => {
      const key = String(story.user._id);
      if (!storyGroups.has(key)) {
        const group = {
          _id: key,
          user: story.user,
          latest_story_at: story.createdAt,
          preview_story: story,
          stories: [],
        };
        storyGroups.set(key, group);
        groupedStories.push(group);
      }

      storyGroups.get(key).stories.push({
        ...story.toObject(),
        viewers_count: Number(story.viewers_count || 0),
      });
    });

    return res.json({ success: true, stories: groupedStories });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const viewStory = async (req, res) => {
  try {
    const { storyId } = req.body;
    const story = await getAccessibleStory(storyId, req.userId);
    if (!story) {
      return res.status(404).json({ success: false, message: "Story not found" });
    }

    if (String(story.user._id) !== String(req.userId)) {
      const existingView = await StoryView.findOne({ story: storyId, viewer: req.userId }).lean();
      if (!existingView) {
        await StoryView.create({ story: storyId, viewer: req.userId });
        story.viewers_count = Number(story.viewers_count || 0) + 1;
        await story.save();
      }
    }

    return res.json({ success: true, message: "Story viewed", viewers_count: Number(story.viewers_count || 0) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getStoryViewers = async (req, res) => {
  try {
    const { storyId } = req.params;
    const story = await Story.findOne({
      _id: storyId,
      user: req.userId,
      expires_at: { $gt: new Date() },
    }).lean();

    if (!story) {
      return res.status(404).json({ success: false, message: "Story not found" });
    }

    const viewers = await StoryView.find({ story: storyId })
      .populate("viewer", "full_name username profile_picture")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      viewers: viewers.map((entry) => ({
        _id: entry.viewer?._id,
        full_name: entry.viewer?.full_name || "Unknown user",
        username: entry.viewer?.username || "",
        profile_picture: entry.viewer?.profile_picture || "",
        viewed_at: entry.createdAt,
      })),
      viewers_count: Number(story.viewers_count || viewers.length || 0),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const replyToStory = async (req, res) => {
  try {
    const { storyId, text = "" } = req.body;
    const trimmedText = text.trim();

    if (!trimmedText) {
      return res.status(400).json({ success: false, message: "Reply text is required" });
    }

    const story = await getAccessibleStory(storyId, req.userId);
    if (!story) {
      return res.status(404).json({ success: false, message: "Story not found" });
    }

    if (String(story.user._id) === String(req.userId)) {
      return res.status(400).json({ success: false, message: "You cannot reply to your own story" });
    }

    const message = await saveMessage({
      senderId: req.userId,
      receiverId: story.user._id,
      messageId: crypto.randomUUID(),
      type: "text",
      text: `Replied: ${trimmedText}`,
      storyReply: {
        storyId: story._id,
        storyUserId: story.user._id,
        previewText: story.content || "Story",
        mediaType: story.media_type,
        mediaUrl: story.media_url || "",
      },
    });

    await emitChatUpdates(message);

    return res.json({
      success: true,
      message: "Reply sent to inbox",
      data: { chatId: message.chatId, messageId: message.messageId },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
