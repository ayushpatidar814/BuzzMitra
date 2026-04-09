const normalizeRelation = (value) => {
  if (!value) return value;
  if (typeof value === "string") return value;
  if (value._id) return String(value._id);
  return String(value);
};

const buildPreferences = (preferences = {}) => ({
  reel_categories: preferences.reel_categories || [],
  reel_subcategories: preferences.reel_subcategories || [],
  target_audiences: preferences.target_audiences || [],
});

export const serializeUserSummary = (user) => ({
  _id: String(user._id),
  full_name: user.full_name,
  username: user.username,
  profile_picture: user.profile_picture,
  bio: user.bio || "",
  location: user.location || "",
  account_visibility: user.account_visibility || "public",
  role: user.role || "user",
  followers_count:
    typeof user.followers_count === "number" ? user.followers_count : (user.followers || []).length,
  following_count:
    typeof user.following_count === "number" ? user.following_count : (user.following || []).length,
});

export const serializeUserProfile = (user, { includeEmail = false, includeRelations = false } = {}) => ({
  ...serializeUserSummary(user),
  ...(includeEmail ? { email: user.email } : {}),
  cover_photo: user.cover_photo || "",
  preferences: buildPreferences(user.preferences),
  ...(includeRelations
    ? {
        followers: (user.followers || []).map(normalizeRelation),
        following: (user.following || []).map(normalizeRelation),
      }
    : {}),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const serializeAuthUser = (user) =>
  serializeUserProfile(user, {
    includeEmail: true,
    includeRelations: true,
  });
