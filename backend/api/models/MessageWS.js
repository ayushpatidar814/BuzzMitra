import mongoose from "mongoose";

const messageWSSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Chat",
    index: true
  },

  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    index: true
  },

  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    index: true
  },

  type: {
    type: String,
    enum: ["text", "media"],
    required: true
  },

  // TEXT MESSAGE
  text: {
    type: String,
    trim: true,
    default: "",
  },

  // MEDIA MESSAGE
  media: {
    url: {
      type: String,
      required: function () {
        return this.type === "media";
      },
    },        
    thumbnail: {
      type: String,
      default: "",
    }, // for video/image preview
    size: {
      type: Number,
      default: 0
    },
    mimeType: {
      type: String,
      default: ""
    },
  },

  storyReply: {
    storyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Story",
      default: null,
    },
    storyUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    previewText: {
      type: String,
      default: "",
    },
    mediaType: {
      type: String,
      enum: ["", "text", "image", "video"],
      default: "",
    },
    mediaUrl: {
      type: String,
      default: "",
    },
  },

  messageId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  status: {
    type: String,
    enum: ["sent", "delivered", "read"],
    default: "sent",
    index: true,
  },

  deliveredTo: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "User",
    default: [],
  },

  readBy: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "User",
    default: [],
  },

}, { timestamps: true, minimize: false });

messageWSSchema.index({ chatId: 1, createdAt: -1 });
messageWSSchema.index({ senderId: 1, receiverId: 1 });
messageWSSchema.index({ receiverId: 1, createdAt: -1 });
messageWSSchema.index({ senderId: 1, createdAt: -1 });
messageWSSchema.index({ chatId: 1, messageId: 1 }, { unique: true });
messageWSSchema.index({ chatId: 1, status: 1, createdAt: -1 });

export default mongoose.model("MessageWS", messageWSSchema);
