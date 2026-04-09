import mongoose from 'mongoose';

const storySchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, default: '' },
    media_url: { type: String, default: '' },
    media_type: { type: String, enum: ["text", "image", "video"] },
    viewers_count: { type: Number, default: 0 },
    background_color: { type: String, default: '#111827' },
    duration_ms: { type: Number, default: 8000 },
    expires_at: { type: Date, index: { expires: 0 } },
},{timestamps: true, minimize: false})

storySchema.index({ user: 1, createdAt: -1 });
storySchema.index({ expires_at: 1, createdAt: -1 });

const Story = mongoose.model('Story', storySchema)

export default Story;
