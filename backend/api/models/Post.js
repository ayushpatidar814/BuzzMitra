import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    content: { type: String, default: '' },
    caption: { type: String, default: '' },
    image_urls: [{ type: String }],
    media_url: { type: String, default: '' },
    thumbnail_url: { type: String, default: '' },
    media_type: { type: String, enum: ["none", "image", "video"], default: "none" },
    post_type: { type: String, enum: ["text", "image", "text_with_image", "reel"], required: true },
    is_reel: { type: Boolean, default: false, index: true },
    duration_seconds: { type: Number, default: 0, max: 45 },
    category: { type: String, default: '' },
    sub_category: { type: String, default: '' },
    target_audience: { type: String, default: '' },
    reel_emojis: { type: String, default: '' },
    gif_url: { type: String, default: '' },
    music: {
        title: { type: String, default: '' },
        artist: { type: String, default: '' },
        url: { type: String, default: '' },
    },
    visibility: { type: String, enum: ["public", "followers", "private"], default: "public", index: true },
    likes_count: { type: Number, default: 0 },
    shares_count: { type: Number, default: 0 },
    saves_count: { type: Number, default: 0 },
    view_count: { type: Number, default: 0 },
    watch_time_total: { type: Number, default: 0 },
    watch_sessions_count: { type: Number, default: 0 },
},{timestamps: true, minimize: false})

postSchema.index({ createdAt: -1 });
postSchema.index({ user: 1, createdAt: -1 });
postSchema.index({ is_reel: 1, createdAt: -1 });
postSchema.index({ visibility: 1, createdAt: -1 });
postSchema.index({ is_reel: 1, visibility: 1, createdAt: -1 });
postSchema.index({ is_reel: 1, category: 1, sub_category: 1, target_audience: 1, createdAt: -1 });

const Post = mongoose.model('Post', postSchema)

export default Post;
