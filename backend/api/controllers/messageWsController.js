import mongoose from "mongoose";
import Chat from "../models/Chat.js";
import MessageWS from "../models/MessageWS.js";
import imagekit from "../configs/imagekit.js";
import User from "../models/User.js";
import fs from "fs/promises";

const USER_SUMMARY = "full_name username profile_picture";
const readUploadedFile = async (file) => {
  const buffer = await fs.readFile(file.path);
  await fs.unlink(file.path).catch(() => {});
  return buffer;
};

const uploadGroupAvatar = async (file, userId) => {
  const buffer = await readUploadedFile(file);
  const uploadRes = await imagekit.upload({
    file: buffer,
    fileName: `group-${userId}-${Date.now()}-${file.originalname}`,
    folder: "group-avatars",
  });

  return uploadRes.url;
};

const isGroupMember = (chat, userId) => chat.participants.some((id) => String(id) === String(userId));
const isGroupAdmin = (chat, userId) => chat.groupAdminIds.some((id) => String(id) === String(userId));
const isGroupOwner = (chat, userId) => String(chat.groupOwnerId) === String(userId);

const buildUnreadChatsCount = (chats, userId) =>
  chats.filter((chat) => Number(chat.unreadCount?.[String(userId)] || 0) > 0).length;

const buildChatSummaries = async (userId, limit) => {
  const chats = await Chat.find({ participants: userId, isGroup: false })
    .populate("lastMessage")
    .sort({ updatedAt: -1 })
    .limit(limit || 0)
    .lean();

  const otherUserIds = chats.map((chat) => chat.participants.find((id) => String(id) !== String(userId)));
  const users = await User.find({ _id: { $in: otherUserIds } }, USER_SUMMARY).lean();
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  return chats
    .map((chat) => {
      const otherUserId = chat.participants.find((id) => String(id) !== String(userId));
      const unreadMessages = Number(chat.unreadCount?.[String(userId)] || 0);
      const clearedAt = chat.clearedBy?.find((entry) => String(entry.userId) === String(userId))?.clearedAt;
      const lastMessage =
        chat.lastMessage && (!clearedAt || new Date(chat.lastMessage.createdAt) > new Date(clearedAt))
          ? chat.lastMessage
          : null;

      return {
        _id: chat._id,
        isGroup: false,
        title: userMap.get(String(otherUserId))?.full_name || "Conversation",
        avatar: userMap.get(String(otherUserId))?.profile_picture || "",
        otherUser: userMap.get(String(otherUserId)) || null,
        lastMessage,
        unreadMessages,
        updatedAt: chat.updatedAt,
      };
    });
};

const buildGroupSummaries = async (userId, limit) => {
  const chats = await Chat.find({ participants: userId, isGroup: true })
    .populate("lastMessage")
    .sort({ updatedAt: -1 })
    .limit(limit || 0)
    .lean();

  return chats
    .map((chat) => {
      const unreadMessages = Number(chat.unreadCount?.[String(userId)] || 0);
      const clearedAt = chat.clearedBy?.find((entry) => String(entry.userId) === String(userId))?.clearedAt;
      const lastMessage =
        chat.lastMessage && (!clearedAt || new Date(chat.lastMessage.createdAt) > new Date(clearedAt))
          ? chat.lastMessage
          : null;

      return {
        _id: chat._id,
        isGroup: true,
        title: chat.groupName || "Group",
        avatar: chat.groupAvatar || "",
        groupName: chat.groupName || "Group",
        groupAvatar: chat.groupAvatar || "",
        lastMessage,
        unreadMessages,
        updatedAt: chat.updatedAt,
      };
    });
};

const uploadMedia = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: "Media can not be empty" });
    }

    const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      await fs.unlink(file.path).catch(() => {});
      return res.status(400).json({ success: false, message: "Only image files are allowed" });
    }

    const buffer = await fs.readFile(file.path);
    const uploadRes = await imagekit.upload({
      file: buffer,
      fileName: `${req.userId}-${Date.now()}-${file.originalname}`,
      folder: "chat-media",
    });

    await fs.unlink(file.path).catch(() => {});

    return res.status(200).json({
      success: true,
      media: {
        url: uploadRes.url,
        thumbnail: uploadRes.thumbnailUrl || "",
        size: file.size,
        mimeType: file.mimetype,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getChats = async (req, res) => {
  try {
    const [directChats, groupChats] = await Promise.all([
      buildChatSummaries(req.userId),
      buildGroupSummaries(req.userId),
    ]);
    const data = [...directChats, ...groupChats].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return res.json({
      success: true,
      data,
      unreadChatsCount: data.filter((chat) => chat.unreadMessages > 0).length,
      totalUnreadMessages: data.reduce((sum, chat) => sum + chat.unreadMessages, 0),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ success: false, message: "Invalid chatId" });
    }

    const chat = await Chat.findById(chatId).lean();
    if (!chat || !chat.participants.some((id) => String(id) === String(req.userId))) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    await Chat.updateOne({ _id: chatId }, { $set: { [`unreadCount.${req.userId}`]: 0 } });
    await MessageWS.updateMany(
      {
        chatId,
        senderId: { $ne: req.userId },
        deliveredTo: { $ne: req.userId },
      },
      {
        $addToSet: { deliveredTo: req.userId },
        $set: { status: chat.isGroup ? "delivered" : "delivered" },
      }
    );
    const clearedAt = chat.clearedBy?.find((entry) => String(entry.userId) === String(req.userId))?.clearedAt;
    const messages = await MessageWS.find({
      chatId,
      ...(clearedAt ? { createdAt: { $gt: clearedAt } } : {}),
    })
      .sort({ createdAt: 1 })
      .limit(80)
      .lean();

    const participants = await User.find({ _id: { $in: chat.participants } }, USER_SUMMARY).lean();
    const participantMap = new Map(participants.map((participant) => [String(participant._id), participant]));

    const receiverId = !chat.isGroup ? chat.participants.find((id) => String(id) !== String(req.userId)) : null;
    const receiver = receiverId ? participantMap.get(String(receiverId)) || null : null;
    const normalizedMessages = messages.map((message) => ({
      ...message,
      deliveredTo: (message.deliveredTo || []).map((id) => String(id)),
      readBy: (message.readBy || []).map((id) => String(id)),
    }));

    return res.json({
      success: true,
      data: {
        receiver,
        chat: {
          _id: chat._id,
          isGroup: Boolean(chat.isGroup),
          groupName: chat.groupName || "",
          groupAvatar: chat.groupAvatar || "",
          groupAdminIds: (chat.groupAdminIds || []).map((id) => String(id)),
          groupOwnerId: chat.groupOwnerId ? String(chat.groupOwnerId) : "",
          participants: participants.map((participant) => ({
            ...participant,
            _id: String(participant._id),
          })),
        },
        messages: normalizedMessages,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getOrCreateChat = async (req, res) => {
  try {
    const { receiverId } = req.body;
    if (!receiverId || String(receiverId) === String(req.userId)) {
      return res.status(400).json({ success: false, message: "Receiver Id is required" });
    }

    const user = await User.findById(receiverId).select("full_name username profile_picture").lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "Receiver not found" });
    }

    const participants = [String(req.userId), String(receiverId)].sort();
    let chat = await Chat.findOne({ isGroup: false, participants });
    if (!chat) {
      chat = await Chat.create({ participants, isGroup: false });
    }

    return res.json({ success: true, data: chat });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const clearChatForMe = async (req, res) => {
  try {
    const { chatId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ success: false, message: "Invalid chatId" });
    }

    await Chat.updateOne({ _id: chatId }, { $pull: { clearedBy: { userId: req.userId } } });
    await Chat.updateOne({
      _id: chatId,
    }, {
      $push: {
        clearedBy: {
          userId: req.userId,
          clearedAt: new Date(),
        },
      },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getRecentChats = async (req, res) => {
  try {
    const [directChats, groupChats] = await Promise.all([
      buildChatSummaries(req.userId, 5),
      buildGroupSummaries(req.userId, 5),
    ]);
    const data = [...directChats, ...groupChats]
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 5);
    return res.json({ success: true, data, message: "Recent chats fetched successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const createGroupChat = async (req, res) => {
  try {
    const { name, participantIds = [] } = req.body;
    const uniqueParticipants = Array.from(new Set([String(req.userId), ...participantIds.map((id) => String(id))]));

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Group name is required" });
    }

    if (uniqueParticipants.length < 3) {
      return res.status(400).json({ success: false, message: "Add at least two other people to create a group" });
    }

    const users = await User.find({ _id: { $in: uniqueParticipants } }).select("_id").lean();
    if (users.length !== uniqueParticipants.length) {
      return res.status(400).json({ success: false, message: "One or more selected users were not found" });
    }

    const chat = await Chat.create({
      participants: uniqueParticipants,
      isGroup: true,
      groupName: name.trim(),
      groupAdminIds: [req.userId],
      groupOwnerId: req.userId,
    });

    return res.json({ success: true, data: chat, message: "Group created successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateGroupName = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { name } = req.body;

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isGroup || !isGroupMember(chat, req.userId)) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    if (!isGroupAdmin(chat, req.userId)) {
      return res.status(403).json({ success: false, message: "Only group admins can rename the group" });
    }

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Group name is required" });
    }

    chat.groupName = name.trim();
    await chat.save();

    return res.json({ success: true, chat, message: "Group name updated" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const addGroupMembers = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { participantIds = [] } = req.body;
    const chat = await Chat.findById(chatId);

    if (!chat || !chat.isGroup || !isGroupMember(chat, req.userId)) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    if (!isGroupAdmin(chat, req.userId)) {
      return res.status(403).json({ success: false, message: "Only group admins can add members" });
    }

    const nextIds = participantIds
      .map((id) => String(id))
      .filter((id) => !chat.participants.some((participantId) => String(participantId) === id));

    if (!nextIds.length) {
      return res.status(400).json({ success: false, message: "No new members selected" });
    }

    const users = await User.find({ _id: { $in: nextIds } }).select("_id").lean();
    if (users.length !== nextIds.length) {
      return res.status(400).json({ success: false, message: "One or more selected users were not found" });
    }

    chat.participants = [...chat.participants.map((id) => String(id)), ...nextIds];
    await chat.save();

    return res.json({ success: true, chat, message: "Members added to group" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const leaveGroup = async (req, res) => {
  try {
    const { chatId } = req.params;
    const chat = await Chat.findById(chatId);

    if (!chat || !chat.isGroup || !isGroupMember(chat, req.userId)) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    chat.participants = chat.participants.filter((id) => String(id) !== String(req.userId));
    chat.groupAdminIds = chat.groupAdminIds.filter((id) => String(id) !== String(req.userId));

    if (!chat.participants.length) {
      await Chat.deleteOne({ _id: chat._id });
      return res.json({ success: true, message: "Group deleted" });
    }

    if (!chat.groupAdminIds.length) {
      chat.groupAdminIds = [chat.participants[0]];
    }

    if (String(chat.groupOwnerId) === String(req.userId)) {
      chat.groupOwnerId = chat.groupAdminIds[0] || chat.participants[0];
    }

    await chat.save();

    return res.json({ success: true, message: "You left the group" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateGroupAvatar = async (req, res) => {
  try {
    const { chatId } = req.params;
    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isGroup || !isGroupMember(chat, req.userId)) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    if (!isGroupAdmin(chat, req.userId)) {
      return res.status(403).json({ success: false, message: "Only group admins can update the group photo" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Group photo is required" });
    }

    chat.groupAvatar = await uploadGroupAvatar(req.file, req.userId);
    await chat.save();

    return res.json({ success: true, chat, message: "Group photo updated" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const removeGroupMember = async (req, res) => {
  try {
    const { chatId, memberId } = req.params;
    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isGroup || !isGroupMember(chat, req.userId)) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    if (!isGroupAdmin(chat, req.userId)) {
      return res.status(403).json({ success: false, message: "Only group admins can remove members" });
    }

    if (!isGroupMember(chat, memberId)) {
      return res.status(404).json({ success: false, message: "Member not found in this group" });
    }

    if (String(memberId) === String(chat.groupOwnerId)) {
      return res.status(403).json({ success: false, message: "Group owner cannot be removed" });
    }

    if (isGroupAdmin(chat, memberId) && !isGroupOwner(chat, req.userId)) {
      return res.status(403).json({ success: false, message: "Only the group owner can remove an admin" });
    }

    chat.participants = chat.participants.filter((id) => String(id) !== String(memberId));
    chat.groupAdminIds = chat.groupAdminIds.filter((id) => String(id) !== String(memberId));
    await chat.save();

    return res.json({ success: true, chat, message: "Member removed from group" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const promoteGroupAdmin = async (req, res) => {
  try {
    const { chatId, memberId } = req.params;
    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isGroup || !isGroupMember(chat, req.userId)) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    if (!isGroupAdmin(chat, req.userId)) {
      return res.status(403).json({ success: false, message: "Only current admins can promote another admin" });
    }

    if (!isGroupMember(chat, memberId)) {
      return res.status(404).json({ success: false, message: "Member not found in this group" });
    }

    if (!isGroupAdmin(chat, memberId)) {
      chat.groupAdminIds.push(memberId);
      await chat.save();
    }

    return res.json({ success: true, chat, message: "Member promoted to admin" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const demoteGroupAdmin = async (req, res) => {
  try {
    const { chatId, memberId } = req.params;
    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isGroup || !isGroupMember(chat, req.userId)) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    if (!isGroupAdmin(chat, req.userId)) {
      return res.status(403).json({ success: false, message: "Only current admins can remove admin access" });
    }

    if (String(memberId) === String(chat.groupOwnerId)) {
      return res.status(403).json({ success: false, message: "Group owner cannot be demoted" });
    }

    if (!isGroupAdmin(chat, memberId)) {
      return res.status(400).json({ success: false, message: "This member is not an admin" });
    }

    chat.groupAdminIds = chat.groupAdminIds.filter((id) => String(id) !== String(memberId));
    await chat.save();

    return res.json({ success: true, chat, message: "Admin access removed" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const transferGroupOwnership = async (req, res) => {
  try {
    const { chatId, memberId } = req.params;
    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isGroup || !isGroupMember(chat, req.userId)) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    if (!isGroupOwner(chat, req.userId)) {
      return res.status(403).json({ success: false, message: "Only the group owner can transfer ownership" });
    }

    if (!isGroupMember(chat, memberId)) {
      return res.status(404).json({ success: false, message: "Member not found in this group" });
    }

    chat.groupOwnerId = memberId;
    if (!isGroupAdmin(chat, memberId)) {
      chat.groupAdminIds.push(memberId);
    }
    await chat.save();

    return res.json({ success: true, chat, message: "Group ownership transferred" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getMessageViewers = async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await MessageWS.findOne({ messageId }).lean();
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    const chat = await Chat.findById(message.chatId).lean();
    if (!chat || !chat.isGroup || !chat.participants.some((id) => String(id) === String(req.userId))) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (String(message.senderId) !== String(req.userId)) {
      return res.status(403).json({ success: false, message: "Only the sender can view delivery details" });
    }

    const viewers = await User.find(
      { _id: { $in: chat.participants.filter((id) => String(id) !== String(req.userId)) } },
      USER_SUMMARY
    ).lean();

    const deliveredSet = new Set((message.deliveredTo || []).map((id) => String(id)));
    const readSet = new Set((message.readBy || []).map((id) => String(id)));

    return res.json({
      success: true,
      viewers: viewers.map((viewer) => ({
        ...viewer,
        _id: String(viewer._id),
        delivered: deliveredSet.has(String(viewer._id)),
        read: readSet.has(String(viewer._id)),
      })),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export { uploadMedia, getChats, getMessages, getOrCreateChat, clearChatForMe, getRecentChats, createGroupChat, getMessageViewers, buildUnreadChatsCount, updateGroupName, addGroupMembers, leaveGroup, updateGroupAvatar, removeGroupMember, promoteGroupAdmin, demoteGroupAdmin, transferGroupOwnership };
