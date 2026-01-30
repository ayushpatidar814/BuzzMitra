// models/Message.js
import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
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
    enum: ["text", "image", "video", "file", "audio"],
    // required: true
  },

  // TEXT MESSAGE
  text: {
    type: String,
    trim: true
  },

  // MEDIA MESSAGE
  media: {
    url: String,        // S3 / Supabase public URL
    thumbnail: String, // for video/image preview
    size: Number,       // bytes
    mimeType: String
  },

  messageId: {
    type: String,
    unique: true,
    default: () => new mongoose.Types.ObjectId().toString(),
    index: true,
  },

  deletedAt: {
    type: Date,
    default: null,
  }

}, { timestamps: true });

messageSchema.index(
  { deletedAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 } // 30 days
);

export default mongoose.model("MessageWS", messageSchema);
