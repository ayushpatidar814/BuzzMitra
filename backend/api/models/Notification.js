import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "follow",
        "like_post",
        "comment_post",
        "reply_comment",
        "share_post",
        "message",
        "story_reply",
        "group_added",
        "group_promoted",
        "group_owner_transferred",
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "",
      trim: true,
    },
    text: {
      type: String,
      default: "",
      trim: true,
    },
    link: {
      type: String,
      default: "",
    },
    entityType: {
      type: String,
      enum: ["", "post", "comment", "story", "chat", "group", "profile"],
      default: "",
    },
    entityId: {
      type: String,
      default: "",
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    readAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true, minimize: false }
);

notificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, createdAt: -1, _id: -1 });
notificationSchema.index({ recipient: 1, type: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
