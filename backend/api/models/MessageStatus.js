// models/MessageStatus.js
import mongoose from "mongoose";

const messageStatusSchema = new mongoose.Schema({
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MessageWS",
    index: true
  },

  userId: {
    type: String,
    ref: "User"
  },

  status: {
    type: String,
    enum: ["sent", "delivered", "read"],
    default: "sent"
  }
}, { timestamps: true });

messageStatusSchema.index(
  { messageId: 1, userId: 1 },
  { unique: true }
);


export default mongoose.model("MessageStatus", messageStatusSchema);
