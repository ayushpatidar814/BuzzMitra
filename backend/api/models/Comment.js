import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      index: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    mentions: [{ type: String }],
    liked_by: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    likes_count: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true, minimize: false }
);

commentSchema.index({ post: 1, createdAt: -1 });
commentSchema.index({ post: 1, parentComment: 1, createdAt: 1 });

export default mongoose.model("Comment", commentSchema);
