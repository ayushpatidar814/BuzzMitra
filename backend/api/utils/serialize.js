const normalizeRelation = (value) => {
  if (!value) return value;
  if (typeof value === "string") return value;
  if (value._id) return String(value._id);
  return String(value);
};

export const serializeUser = (user) => ({
  _id: String(user._id),
  email: user.email,
  full_name: user.full_name,
  username: user.username,
  bio: user.bio,
  profile_picture: user.profile_picture,
  cover_photo: user.cover_photo,
  location: user.location,
  followers: (user.followers || []).map(normalizeRelation),
  following: (user.following || []).map(normalizeRelation),
  followers_count: typeof user.followers_count === "number" ? user.followers_count : (user.followers || []).length,
  following_count: typeof user.following_count === "number" ? user.following_count : (user.following || []).length,
  account_visibility: user.account_visibility || "public",
  role: user.role || "user",
  preferences: user.preferences || {
    reel_categories: [],
    reel_subcategories: [],
    target_audiences: [],
  },
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});
