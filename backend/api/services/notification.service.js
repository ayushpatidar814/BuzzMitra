import Notification from "../models/Notification.js";
import { getIO } from "../sockets/index.js";

const ACTOR_FIELDS = "full_name username profile_picture";

const buildGroupedLikeText = ({ actorName = "Someone", count = 1, contentLabel = "post" }) => {
  if (count <= 1) {
    return `${actorName} liked your ${contentLabel}.`;
  }
  if (count === 2) {
    return `${actorName} and 1 other person liked your ${contentLabel}.`;
  }
  return `${actorName} and ${count - 1} others liked your ${contentLabel}.`;
};

const serializeNotification = (notification) => ({
  _id: String(notification._id),
  type: notification.type,
  title: notification.title,
  text: notification.text,
  link: notification.link,
  entityType: notification.entityType || "",
  entityId: notification.entityId || "",
  meta: notification.meta || {},
  readAt: notification.readAt,
  createdAt: notification.createdAt,
  actor: notification.actor
    ? {
        _id: String(notification.actor._id),
        full_name: notification.actor.full_name,
        username: notification.actor.username,
        profile_picture: notification.actor.profile_picture,
      }
    : null,
});

const emitNotification = async (recipientId, notification) => {
  const io = getIO();
  if (!io) return;

  io.to(`user:${String(recipientId)}`).emit("notification:new", notification);
  const unreadCount = await Notification.countDocuments({ recipient: recipientId, readAt: null });
  io.to(`user:${String(recipientId)}`).emit("notification:unread_count", { count: unreadCount });
};

export const createNotification = async ({
  recipientId,
  actorId = null,
  type,
  title = "",
  text = "",
  link = "",
  entityType = "",
  entityId = "",
  meta = {},
}) => {
  if (!recipientId) return null;
  if (actorId && String(recipientId) === String(actorId)) return null;

  if (type === "like_post" && entityId) {
    const existing = await Notification.findOne({
      recipient: recipientId,
      type,
      entityId: String(entityId),
      readAt: null,
    })
      .populate("actor", ACTOR_FIELDS)
      .sort({ createdAt: -1 });

    if (existing) {
      const previousActorIds = Array.isArray(existing.meta?.actorIds)
        ? existing.meta.actorIds.map((id) => String(id))
        : [];
      const nextActorIds = actorId
        ? Array.from(new Set([...previousActorIds, String(actorId)]))
        : previousActorIds;
      const likeCount = Math.max(Number(existing.meta?.likeCount || previousActorIds.length || 1), nextActorIds.length || 1);

      existing.actor = actorId || existing.actor;
      existing.title = title || "New likes";
      existing.text = buildGroupedLikeText({
        actorName: existing.actor?.full_name || "Someone",
        count: likeCount,
        contentLabel: existing.meta?.contentLabel || meta?.contentLabel || "post",
      });
      existing.meta = {
        ...(existing.meta || {}),
        ...(meta || {}),
        actorIds: nextActorIds,
        likeCount,
      };
      existing.createdAt = new Date();
      existing.updatedAt = new Date();
      existing.markModified("meta");
      await existing.save();

      const refreshed = await Notification.findById(existing._id).populate("actor", ACTOR_FIELDS).lean();
      const serializedExisting = serializeNotification(refreshed);
      await emitNotification(recipientId, serializedExisting);
      return serializedExisting;
    }
  }

  const created = await Notification.create({
    recipient: recipientId,
    actor: actorId,
    type,
    title,
    text,
    link,
    entityType,
    entityId: entityId ? String(entityId) : "",
    meta: type === "like_post"
      ? {
          ...meta,
          actorIds: actorId ? [String(actorId)] : [],
          likeCount: 1,
        }
      : meta,
  });

  const populated = await Notification.findById(created._id).populate("actor", ACTOR_FIELDS).lean();
  const serialized = serializeNotification(populated);
  await emitNotification(recipientId, serialized);
  return serialized;
};

export const createBulkNotifications = async (payloads = []) => {
  const validPayloads = payloads.filter((item) => item?.recipientId && (!item.actorId || String(item.recipientId) !== String(item.actorId)));
  if (!validPayloads.length) return [];

  const created = await Notification.insertMany(
    validPayloads.map((item) => ({
      recipient: item.recipientId,
      actor: item.actorId || null,
      type: item.type,
      title: item.title || "",
      text: item.text || "",
      link: item.link || "",
      entityType: item.entityType || "",
      entityId: item.entityId ? String(item.entityId) : "",
      meta: item.meta || {},
    }))
  );

  const notifications = await Notification.find({ _id: { $in: created.map((item) => item._id) } })
    .populate("actor", ACTOR_FIELDS)
    .sort({ createdAt: -1 })
    .lean();

  await Promise.all(
    notifications.map((notification) => emitNotification(notification.recipient, serializeNotification(notification)))
  );

  return notifications.map(serializeNotification);
};

export const getUnreadNotificationsCount = async (recipientId) =>
  Notification.countDocuments({ recipient: recipientId, readAt: null });

export const serializeNotifications = (items = []) => items.map(serializeNotification);
