import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    participants: { 
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      index: true, 
      required: true
    },
    isGroup: { 
      type: Boolean, 
      default: false 
    },
    groupName: {
      type: String,
      trim: true,
      default: "",
    },
    groupAvatar: {
      type: String,
      default: "",
    },
    groupAdminIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    groupOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lastMessage: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "MessageWS" 
    },
    clearedBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          index: true
        },
        clearedAt: {
          type: Date
        }
      }
    ],
    unreadCount: {
      type: Map,
      of: Number,
      default: {}
    },
  },
  { timestamps: true }
);

chatSchema.index({ participants: 1, isGroup: 1 });
chatSchema.index({ isGroup: 1, updatedAt: -1 });
chatSchema.index({ participants: 1, updatedAt: -1 });
chatSchema.index({ lastMessage: 1 });
chatSchema.index({ "clearedBy.userId": 1, updatedAt: -1 });

export default mongoose.model("Chat", chatSchema);
