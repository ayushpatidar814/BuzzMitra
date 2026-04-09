import mongoose from "mongoose";
import Chat from "../models/Chat.js";
import MessageWS from "../models/MessageWS.js";
import User from "../models/User.js";
import fs from "fs/promises";
import { uploadOptimizedMedia } from "../utils/media.js";
import { isValidObjectId, parseBoundedInteger, trimString } from "../utils/request.js";
import { buildCacheKey, deleteCacheByPrefix, getCache, setCache } from "../utils/cache.js";
import { ok, paginated } from "../utils/response.js";
import { createBulkNotifications, createNotification } from "../services/notification.service.js";

const USER_SUMMARY = "full_name username profile_picture";
const encodeMessageCursor = (message) =>
  message
    ? Buffer.from(
        JSON.stringify({
          createdAt: message.createdAt,
          id: String(message._id),
        })
      ).toString("base64")
    : null;

const decodeMessageCursor = (cursor) => {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
    if (!parsed?.createdAt || !parsed?.id) return null;
    return {
      createdAt: new Date(parsed.createdAt),
      id: new mongoose.Types.ObjectId(parsed.id),
    };
  } catch {
    return null;
  }
};
const uploadGroupAvatar = async (file, userId) => {
  const uploaded = await uploadOptimizedMedia(
    file,
    "group-avatars",
    `group-${userId}-${Date.now()}-${file.originalname}`
  );
  return uploaded.url;
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

    const uploadRes = await uploadOptimizedMedia(
      file,
      "chat-media",
      `${req.userId}-${Date.now()}-${file.originalname}`
    );

    return res.status(200).json({
      success: true,
      media: {
        url: uploadRes.url,
        thumbnail: uploadRes.thumbnail || "",
        size: uploadRes.size,
        mimeType: uploadRes.mimeType,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getChats = async (req, res) => {
  try {
    const cacheKey = buildCacheKey("cache", "chats", req.userId);
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    const [directChats, groupChats] = await Promise.all([
      buildChatSummaries(req.userId),
      buildGroupSummaries(req.userId),
    ]);
    const data = [...directChats, ...groupChats].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    const payload = {
      success: true,
      data,
      unreadChatsCount: data.filter((chat) => chat.unreadMessages > 0).length,
      totalUnreadMessages: data.reduce((sum, chat) => sum + chat.unreadMessages, 0),
    };
    await setCache(cacheKey, payload, 30);
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const cursor = decodeMessageCursor(req.query.cursor);
    const limit = parseBoundedInteger(req.query.limit, { defaultValue: 40, min: 10, max: 80 });
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
    const cacheKey = buildCacheKey("cache", "chat-messages", chatId, String(req.userId), `cursor=${req.query.cursor || "first"}`, `limit=${limit}`);
    const cached = cursor ? null : await getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    const messages = await MessageWS.find({
      chatId,
      ...(clearedAt ? { createdAt: { $gt: clearedAt } } : {}),
      ...(cursor
        ? {
            $or: [
              { createdAt: { $lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
            ],
          }
        : {}),
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = messages.length > limit;
    const pageMessages = messages.slice(0, limit).reverse();

    const participants = await User.find({ _id: { $in: chat.participants } }, USER_SUMMARY).lean();
    const participantMap = new Map(participants.map((participant) => [String(participant._id), participant]));

    const receiverId = !chat.isGroup ? chat.participants.find((id) => String(id) !== String(req.userId)) : null;
    const receiver = receiverId ? participantMap.get(String(receiverId)) || null : null;
    const normalizedMessages = pageMessages.map((message) => ({
      ...message,
      deliveredTo: (message.deliveredTo || []).map((id) => String(id)),
      readBy: (message.readBy || []).map((id) => String(id)),
    }));

    const payload = {
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
        hasMore,
        nextCursor: hasMore && pageMessages.length ? encodeMessageCursor(pageMessages[0]) : null,
      },
      messages: normalizedMessages,
      nextCursor: hasMore && pageMessages.length ? encodeMessageCursor(pageMessages[0]) : null,
      hasMore,
      meta: {
        nextCursor: hasMore && pageMessages.length ? encodeMessageCursor(pageMessages[0]) : null,
        hasMore,
        count: normalizedMessages.length,
      },
    };
    if (!cursor) {
      await setCache(cacheKey, payload, 20);
    }
    return res.json(payload);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getOrCreateChat = async (req, res) => {
  try {
    const { receiverId } = req.body;
    if (!isValidObjectId(receiverId)) {
      return res.status(400).json({ success: false, message: "Valid receiver id is required" });
    }
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

    await deleteCacheByPrefix(`cache:chats:${String(req.userId)}`);
    return ok(res, { data: chat });
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

    await deleteCacheByPrefix(`cache:chat-messages:${chatId}:${String(req.userId)}`, `cache:chats:${String(req.userId)}`);

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
    const name = trimString(req.body.name, { maxLength: 60 });
    const participantIds = Array.isArray(req.body.participantIds) ? req.body.participantIds : [];
    const normalizedParticipantIds = participantIds
      .map((id) => String(id))
      .filter((id) => isValidObjectId(id) && id !== String(req.userId));
    const uniqueParticipants = Array.from(new Set([String(req.userId), ...normalizedParticipantIds]));

    if (!name) {
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

    await deleteCacheByPrefix(...uniqueParticipants.map((id) => `cache:chats:${String(id)}`));
    return ok(res, { data: chat, message: "Group created successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateGroupName = async (req, res) => {
  try {
    const { chatId } = req.params;
    const name = trimString(req.body.name, { maxLength: 60 });

    if (!isValidObjectId(chatId)) {
      return res.status(400).json({ success: false, message: "Invalid group id" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.isGroup || !isGroupMember(chat, req.userId)) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    if (!isGroupAdmin(chat, req.userId)) {
      return res.status(403).json({ success: false, message: "Only group admins can rename the group" });
    }

    if (!name) {
      return res.status(400).json({ success: false, message: "Group name is required" });
    }

    chat.groupName = name;
    await chat.save();
    await deleteCacheByPrefix(...(chat.participants || []).map((id) => `cache:chats:${String(id)}`));

    return res.json({ success: true, chat, message: "Group name updated" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const addGroupMembers = async (req, res) => {
  try {
    const { chatId } = req.params;
    const participantIds = Array.isArray(req.body.participantIds) ? req.body.participantIds : [];
    if (!isValidObjectId(chatId)) {
      return res.status(400).json({ success: false, message: "Invalid group id" });
    }
    const chat = await Chat.findById(chatId);

    if (!chat || !chat.isGroup || !isGroupMember(chat, req.userId)) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    if (!isGroupAdmin(chat, req.userId)) {
      return res.status(403).json({ success: false, message: "Only group admins can add members" });
    }

    const nextIds = participantIds
      .map((id) => String(id))
      .filter((id) => isValidObjectId(id) && !chat.participants.some((participantId) => String(participantId) === id));

    if (!nextIds.length) {
      return res.status(400).json({ success: false, message: "No new members selected" });
    }

    const users = await User.find({ _id: { $in: nextIds } }).select("_id").lean();
    if (users.length !== nextIds.length) {
      return res.status(400).json({ success: false, message: "One or more selected users were not found" });
    }

    chat.participants = [...chat.participants.map((id) => String(id)), ...nextIds];
    await chat.save();
    await deleteCacheByPrefix(...(chat.participants || []).map((id) => `cache:chats:${String(id)}`));
    await createBulkNotifications(
      nextIds.map((memberId) => ({
        recipientId: memberId,
        actorId: req.userId,
        type: "group_added",
        title: "Added to a group",
        text: `You were added to ${chat.groupName || "a group"}.`,
        link: `/app/messages/${chat._id}`,
        entityType: "group",
        entityId: chat._id,
      }))
    );

    return res.json({ success: true, chat, message: "Members added to group" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const leaveGroup = async (req, res) => {
  try {
    const { chatId } = req.params;
    if (!isValidObjectId(chatId)) {
      return res.status(400).json({ success: false, message: "Invalid group id" });
    }
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
    await deleteCacheByPrefix(...(chat.participants || []).map((id) => `cache:chats:${String(id)}`), `cache:chats:${String(req.userId)}`);

    return res.json({ success: true, message: "You left the group" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateGroupAvatar = async (req, res) => {
  try {
    const { chatId } = req.params;
    if (!isValidObjectId(chatId)) {
      return res.status(400).json({ success: false, message: "Invalid group id" });
    }
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
    await deleteCacheByPrefix(...(chat.participants || []).map((id) => `cache:chats:${String(id)}`));

    return res.json({ success: true, chat, message: "Group photo updated" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const removeGroupMember = async (req, res) => {
  try {
    const { chatId, memberId } = req.params;
    if (!isValidObjectId(chatId) || !isValidObjectId(memberId)) {
      return res.status(400).json({ success: false, message: "Invalid member request" });
    }
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
    await deleteCacheByPrefix(...(chat.participants || []).map((id) => `cache:chats:${String(id)}`), `cache:chats:${String(memberId)}`);

    return res.json({ success: true, chat, message: "Member removed from group" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const promoteGroupAdmin = async (req, res) => {
  try {
    const { chatId, memberId } = req.params;
    if (!isValidObjectId(chatId) || !isValidObjectId(memberId)) {
      return res.status(400).json({ success: false, message: "Invalid member request" });
    }
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
    await deleteCacheByPrefix(...(chat.participants || []).map((id) => `cache:chats:${String(id)}`));
    await createNotification({
      recipientId: memberId,
      actorId: req.userId,
      type: "group_promoted",
      title: "You are now an admin",
      text: `You were made an admin in ${chat.groupName || "the group"}.`,
      link: `/app/messages/${chat._id}`,
      entityType: "group",
      entityId: chat._id,
    });

    return res.json({ success: true, chat, message: "Member promoted to admin" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const demoteGroupAdmin = async (req, res) => {
  try {
    const { chatId, memberId } = req.params;
    if (!isValidObjectId(chatId) || !isValidObjectId(memberId)) {
      return res.status(400).json({ success: false, message: "Invalid member request" });
    }
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
    await deleteCacheByPrefix(...(chat.participants || []).map((id) => `cache:chats:${String(id)}`));

    return res.json({ success: true, chat, message: "Admin access removed" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const transferGroupOwnership = async (req, res) => {
  try {
    const { chatId, memberId } = req.params;
    if (!isValidObjectId(chatId) || !isValidObjectId(memberId)) {
      return res.status(400).json({ success: false, message: "Invalid member request" });
    }
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
    await deleteCacheByPrefix(...(chat.participants || []).map((id) => `cache:chats:${String(id)}`));
    await createNotification({
      recipientId: memberId,
      actorId: req.userId,
      type: "group_owner_transferred",
      title: "Group ownership transferred",
      text: `You are now the owner of ${chat.groupName || "the group"}.`,
      link: `/app/messages/${chat._id}`,
      entityType: "group",
      entityId: chat._id,
    });

    return res.json({ success: true, chat, message: "Group ownership transferred" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getMessageViewers = async (req, res) => {
  try {
    const { messageId } = req.params;
    if (!messageId?.trim()) {
      return res.status(400).json({ success: false, message: "Invalid message id" });
    }
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
