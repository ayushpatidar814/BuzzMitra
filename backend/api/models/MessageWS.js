import mongoose from "mongoose";

const messageWSSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Chat",
    index: true
  },

  senderId: {
    type: String,
    ref: "User",
    index: true
  },

  receiverId: {
    type: String,
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

}, { timestamps: true });

messageWSSchema.index({ deletedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
messageWSSchema.index({ chatId: 1, createdAt: -1 });
messageWSSchema.index({ senderId: 1, receiverId: 1 });

export default mongoose.model("MessageWS", messageWSSchema);
