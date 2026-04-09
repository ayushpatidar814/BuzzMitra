import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    full_name: { type: String, required: true, default: '' },
    username: { type: String, unique: true, sparse: true, trim: true },
    password_hash: { type: String, default: null, select: false },
    password_salt: { type: String, default: null, select: false },
    auth_provider: { type: String, enum: ["local", "google", "facebook"], default: "local" },
    google_id: { type: String, default: null, index: true, sparse: true },
    facebook_id: { type: String, default: null, index: true, sparse: true },
    bio: { type: String, default: 'Hey there! I am using BuzzMitra.' },
    profile_picture: { type: String, default: '' },
    cover_photo: { type: String, default: '' },
    location: { type: String, default: '' },
    account_visibility: { type: String, enum: ["public", "private"], default: "public" },
    role: { type: String, enum: ["user", "creator", "brand"], default: "user" },
    followers_count: { type: Number, default: 0 },
    following_count: { type: Number, default: 0 },
    preferences: {
        reel_categories: [{ type: String }],
        reel_subcategories: [{ type: String }],
        target_audiences: [{ type: String }],
    },
    isOnline: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true, minimize: false
});

userSchema.index({
    username: "text",
    full_name: "text",
    bio: "text",
    location: "text"
});

const User = mongoose.model('User', userSchema);


export default User;
