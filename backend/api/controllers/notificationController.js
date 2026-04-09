import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import { parseBoundedInteger } from "../utils/request.js";
import { ok, paginated } from "../utils/response.js";
import { serializeNotifications } from "../services/notification.service.js";

const decodeCursor = (cursor) => {
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

const encodeCursor = (item) =>
  item
    ? Buffer.from(
        JSON.stringify({
          createdAt: item.createdAt,
          id: String(item._id),
        })
      ).toString("base64")
    : null;

export const getNotifications = async (req, res) => {
  try {
    const cursor = decodeCursor(req.query.cursor);
    const limit = parseBoundedInteger(req.query.limit, { defaultValue: 20, min: 1, max: 40 });
    const filter = String(req.query.filter || "all");

    const query = {
      recipient: req.userId,
      ...(filter === "unread" ? { readAt: null } : {}),
      ...(cursor
        ? {
            $or: [
              { createdAt: { $lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
            ],
          }
        : {}),
    };

    const items = await Notification.find(query)
      .populate("actor", "full_name username profile_picture")
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = items.length > limit;
    const pageItems = items.slice(0, limit);
    return paginated(res, {
      itemKey: "notifications",
      items: serializeNotifications(pageItems),
      hasMore,
      nextCursor: hasMore && pageItems.length ? encodeCursor(pageItems[pageItems.length - 1]) : null,
      message: "Notifications loaded",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getUnreadNotificationsCount = async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({ recipient: req.userId, readAt: null });
    return ok(res, { data: { unreadCount }, unreadCount, message: "Unread notifications count loaded" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: req.userId, readAt: null },
      { $set: { readAt: new Date() } },
      { new: true }
    );

    return ok(res, {
      data: {
        notificationId,
        readAt: notification?.readAt || new Date(),
      },
      message: "Notification marked as read",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.userId, readAt: null },
      { $set: { readAt: new Date() } }
    );
    return ok(res, { message: "All notifications marked as read" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
