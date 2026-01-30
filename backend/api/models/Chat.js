import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    participants: [{ 
      type: [String], 
      ref: "User",
      index: true, 
    }],
    isGroup: { 
      type: Boolean, 
      default: false 
    },
    lastMessage: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "MessageWS" 
    },
  },
  { timestamps: true }
);

chatSchema.index({ participants: 1 }, { unique: true });

export default mongoose.model("Chat", chatSchema);
