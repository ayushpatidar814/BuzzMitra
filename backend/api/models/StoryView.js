import mongoose from "mongoose";

const storyViewSchema = new mongoose.Schema(
  {
    story: { type: mongoose.Schema.Types.ObjectId, ref: "Story", required: true },
    viewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

storyViewSchema.index({ story: 1, viewer: 1 }, { unique: true });
storyViewSchema.index({ story: 1, createdAt: -1 });
storyViewSchema.index({ viewer: 1, createdAt: -1 });

const StoryView = mongoose.model("StoryView", storyViewSchema);

export default StoryView;
