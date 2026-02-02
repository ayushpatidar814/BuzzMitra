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
    trim: true
  },

  // MEDIA MESSAGE
  media: {
    type: String,        // S3 / Supabase public URL
    thumbnail: String, // for video/image preview
    size: Number,       // bytes
    mimeType: String
  },

  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MessageWS",
    required: true,
  },
  
  deletedAt: {
    type: Date,
    default: null,
  }

}, { timestamps: true });

messageWSSchema.index({ deletedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
messageWSSchema.index({ chatId: 1, createdAt: -1 });
messageWSSchema.index({ senderId: 1, receiverId: 1 });

export default mongoose.model("MessageWS", messageWSSchema);
