import mongoose from "mongoose";

const postReactionSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["like", "save", "share"],
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

postReactionSchema.index({ postId: 1, userId: 1, type: 1 }, { unique: true });
postReactionSchema.index({ postId: 1, type: 1, createdAt: -1 });
postReactionSchema.index({ userId: 1, type: 1, createdAt: -1 });

export default mongoose.model("PostReaction", postReactionSchema);
