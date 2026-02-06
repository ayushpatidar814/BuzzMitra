import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    participants: { 
      type: [String], 
      ref: "User",
      index: true, 
      required: true
    },
    isGroup: { 
      type: Boolean, 
      default: false 
    },
    user: {
      type: {},
    },
    lastMessage: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "MessageWS" 
    },
  },
  { timestamps: true }
);

export default mongoose.model("Chat", chatSchema);
