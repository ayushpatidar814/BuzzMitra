import crypto from "crypto";
import mongoose from "mongoose";
import Follow from "../models/Follow.js";
import User from "../models/User.js";
import Post from "../models/Post.js";
import { enrichPost, enrichPosts } from "./postController.js";
import {
  createPasswordHash,
  createUsernameFromIdentity,
  signAuthToken,
  verifyPassword,
} from "../utils/auth.js";
import { buildCacheKey, deleteCacheByPrefix, getCache, setCache } from "../utils/cache.js";
import { uploadOptimizedMedia } from "../utils/media.js";
import { isValidEmail, isValidObjectId, parseBoundedInteger, trimString } from "../utils/request.js";
import { ok, paginated } from "../utils/response.js";
import { createNotification } from "../services/notification.service.js";
import { serializeAuthUser, serializeUserProfile, serializeUserSummary } from "../utils/serialize.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const USER_SUMMARY_FIELDS = "full_name username bio profile_picture cover_photo location followers_count following_count account_visibility role preferences createdAt updatedAt";

const normalizeBaseUrl = (value = "") => String(value || "").replace(/\/+$/, "");

const getFrontendBaseUrl = () => normalizeBaseUrl(process.env.FRONTEND_URL || "http://localhost:5173");

const getBackendBaseUrl = (req) => {
  if (process.env.BACKEND_URL) {
    return normalizeBaseUrl(process.env.BACKEND_URL);
  }

  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return normalizeBaseUrl(`${protocol}://${host}`);
};

const getOAuthCallbackUrl = (req, provider) => `${getBackendBaseUrl(req)}/api/user/oauth/${provider}/callback`;

const redirectOAuthFailure = (res, reason = "failed") =>
  res.redirect(`${getFrontendBaseUrl()}/login?oauth=${encodeURIComponent(reason)}`);

const uploadAsset = async (file, folder) => (await uploadOptimizedMedia(file, folder, file.originalname)).url;

const ensureUniqueUsername = async (base) => {
  const seed = createUsernameFromIdentity(base);
  let username = seed;
  let attempt = 1;

  while (await User.findOne({ username })) {
    username = `${seed}_${attempt}`;
    attempt += 1;
  }

  return username;
};

const attachFollowIds = async (userDoc) => {
  if (!userDoc) return null;
  const user = userDoc.toObject?.() || { ...userDoc };
  const [followingEdges, followerEdges, followingCount, followersCount] = await Promise.all([
    Follow.find({ followerId: user._id }).select("followingId").lean(),
    Follow.find({ followingId: user._id }).select("followerId").lean(),
    Follow.countDocuments({ followerId: user._id }),
    Follow.countDocuments({ followingId: user._id }),
  ]);

  user.following = followingEdges.map((edge) => String(edge.followingId));
  user.followers = followerEdges.map((edge) => String(edge.followerId));
  user.following_count = followingCount;
  user.followers_count = followersCount;
  if (userDoc.following_count !== followingCount || userDoc.followers_count !== followersCount) {
    User.updateOne(
      { _id: user._id },
      { $set: { following_count: followingCount, followers_count: followersCount } }
    ).catch(() => {});
  }
  return user;
};

const serializeListedUsers = (users = []) =>
  users.map((userDoc) =>
    serializeUserSummary({
      ...(userDoc.toObject?.() || userDoc),
      followers: [],
      following: [],
    })
  );

const issueAuthResponse = (res, user, message = "Authenticated") => {
  const token = signAuthToken({ userId: String(user._id), email: user.email });
  return res.json({
    success: true,
    message,
    token,
    user: serializeAuthUser(user),
  });
};

const encodeListCursor = (item) =>
  item
    ? Buffer.from(
        JSON.stringify({
          createdAt: item.createdAt,
          id: String(item._id),
        })
      ).toString("base64")
    : null;

const decodeListCursor = (cursor) => {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
    if (!parsed?.createdAt || !parsed?.id) return null;
    return {
      createdAt: new Date(parsed.createdAt),
      id: new mongoose.Types.ObjectId(parsed.id),
    };
  } catch {
    return null;
  }
};

const buildCursorMatch = (cursor) => {
  if (!cursor) return {};
  return {
    $or: [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
    ],
  };
};

const getResolvedProfileId = (req) => String(req.params.profileId || req.body.profileId || req.userId);

export const registerUser = async (req, res) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const password = String(req.body.password || "");
    const full_name = trimString(req.body.full_name, { maxLength: 80 });
    const username = trimString(req.body.username, { maxLength: 30 });

    if (!email || !password || !full_name) {
      return res.status(400).json({ success: false, message: "Email, password and full name are required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Enter a valid email address" });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: "An account already exists with this email" });
    }

    const uniqueUsername = await ensureUniqueUsername(username || email.split("@")[0]);
    const { salt, passwordHash } = createPasswordHash(password);

    const user = await User.create({
      email,
      full_name,
      username: uniqueUsername,
      password_hash: passwordHash,
      password_salt: salt,
      auth_provider: "local",
    });

    return issueAuthResponse(res, user, "Registration successful");
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const loginUser = async (req, res) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const user = await User.findOne({ email }).select("+password_hash +password_salt");
    
    if (!user || !verifyPassword(password || "", user.password_salt, user.password_hash)) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    return issueAuthResponse(res, user, "Welcome back");
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const oauthStart = async (req, res) => {
  try {
    const { provider } = req.params;
    if (!["google", "facebook"].includes(provider)) {
      return res.status(400).json({ success: false, message: "Unsupported OAuth provider" });
    }

    const state = crypto.randomBytes(16).toString("hex");
    const callbackUrl = getOAuthCallbackUrl(req, provider);

    if (provider === "google") {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(500).json({ success: false, message: "Google login is not configured yet" });
      }

      const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: callbackUrl,
        response_type: "code",
        scope: "openid email profile",
        access_type: "offline",
        prompt: "consent",
        state,
      });
      return res.json({ success: true, url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
    }

    if (!process.env.FACEBOOK_CLIENT_ID || !process.env.FACEBOOK_CLIENT_SECRET) {
      return res.status(500).json({ success: false, message: "Facebook login is not configured yet" });
    }

    const params = new URLSearchParams({
      client_id: process.env.FACEBOOK_CLIENT_ID,
      redirect_uri: callbackUrl,
      response_type: "code",
      scope: "email,public_profile",
      state,
    });
    return res.json({ success: true, url: `https://www.facebook.com/v22.0/dialog/oauth?${params.toString()}` });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const exchangeGoogleCode = async (req, code) => {
  const callbackUrl = getOAuthCallbackUrl(req, "google");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: callbackUrl,
      grant_type: "authorization_code",
    }),
  });
  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description || tokenData.error || "Google sign-in failed");
  }

  const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profileData = await profileRes.json();

  if (!profileRes.ok) {
    throw new Error(profileData.error?.message || "Unable to load Google profile");
  }

  return profileData;
};

const exchangeFacebookCode = async (req, code) => {
  const callbackUrl = getOAuthCallbackUrl(req, "facebook");
  const tokenParams = new URLSearchParams({
    client_id: process.env.FACEBOOK_CLIENT_ID,
    client_secret: process.env.FACEBOOK_CLIENT_SECRET,
    redirect_uri: callbackUrl,
    code,
  });
  const tokenRes = await fetch(`https://graph.facebook.com/v22.0/oauth/access_token?${tokenParams.toString()}`);
  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error?.message || "Facebook sign-in failed");
  }

  const profileRes = await fetch(
    `https://graph.facebook.com/me?fields=id,name,email,picture.width(512).height(512)&access_token=${tokenData.access_token}`
  );
  const profileData = await profileRes.json();

  if (!profileRes.ok) {
    throw new Error(profileData.error?.message || "Unable to load Facebook profile");
  }

  return profileData;
};

export const oauthCallback = async (req, res) => {
  try {
    const { provider } = req.params;
    const { code } = req.query;

    if (!["google", "facebook"].includes(provider)) {
      return redirectOAuthFailure(res, "unsupported-provider");
    }

    if (!code) {
      return redirectOAuthFailure(res, "missing-code");
    }

    const profile = provider === "google" ? await exchangeGoogleCode(req, code) : await exchangeFacebookCode(req, code);
    const email = profile.email?.toLowerCase?.();

    if (!email) {
      return redirectOAuthFailure(res, "missing-email");
    }

    const idField = provider === "google" ? "google_id" : "facebook_id";
    const providerId = String(provider === "google" ? profile.id : profile.id);
    let user = await User.findOne({ $or: [{ email }, { [idField]: providerId }] });

    if (!user) {
      user = await User.create({
        email,
        full_name: profile.name,
        username: await ensureUniqueUsername(email.split("@")[0]),
        auth_provider: provider,
        [idField]: providerId,
        profile_picture: provider === "google" ? profile.picture : profile.picture?.data?.url,
      });
    } else {
      user[idField] = providerId;
      user.auth_provider = provider;
      if (!user.profile_picture) {
        user.profile_picture = provider === "google" ? profile.picture : profile.picture?.data?.url;
      }
      await user.save();
    }

    const token = signAuthToken({ userId: String(user._id), email: user.email });
    return res.redirect(`${getFrontendBaseUrl()}/oauth/callback?token=${encodeURIComponent(token)}`);
  } catch (error) {
    console.log(error);
    return redirectOAuthFailure(res, error.message || "failed");
  }
};

export const getUserData = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    return res.json({ success: true, user: serializeAuthUser(await attachFollowIds(user)) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updatedUserData = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    let { username, bio, location, full_name, account_visibility, role } = req.body;

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    username = trimString(username, { maxLength: 30 });
    bio = trimString(bio, { maxLength: 180 });
    location = trimString(location, { maxLength: 80 });
    full_name = trimString(full_name, { maxLength: 80 });

    if (account_visibility && !["public", "private"].includes(account_visibility)) {
      return res.status(400).json({ success: false, message: "Invalid account visibility" });
    }

    if (role && !["user", "creator", "brand"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid account role" });
    }

    if (username && username !== user.username) {
      const existing = await User.findOne({ username, _id: { $ne: user._id } });
      if (existing) {
        return res.status(409).json({ success: false, message: "Username is already taken" });
      }
      user.username = username;
    }

    user.bio = bio ?? user.bio;
    user.location = location ?? user.location;
    user.full_name = full_name ?? user.full_name;
    user.account_visibility = account_visibility ?? user.account_visibility;
    user.role = role ?? user.role;

    const profile = req.files?.profile?.[0];
    const cover = req.files?.cover?.[0];

    if (profile) {
      user.profile_picture = await uploadAsset(profile, "profiles");
    }

    if (cover) {
      user.cover_photo = await uploadAsset(cover, "covers");
    }

    await user.save();
    await Promise.all([
      deleteCacheByPrefix(`cache:profile:${String(user._id)}`),
      deleteCacheByPrefix(`cache:profile-content:${String(user._id)}`),
      deleteCacheByPrefix(`cache:profile-connections:${String(user._id)}`),
      deleteCacheByPrefix("cache:feed:public"),
      deleteCacheByPrefix("cache:reels:public"),
    ]);

    return res.json({ success: true, user: serializeAuthUser(await attachFollowIds(user)), message: "Profile updated successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const discoverUsers = async (req, res) => {
  try {
    const trimmed = trimString(req.body.input, { maxLength: 80 });
    const baseQuery = { _id: { $ne: req.userId } };
    const allUsers = trimmed
      ? await User.find(
          {
            ...baseQuery,
            $text: { $search: trimmed },
          },
          { score: { $meta: "textScore" } }
        )
          .sort({ score: { $meta: "textScore" }, followers_count: -1, createdAt: -1 })
          .limit(24)
      : await User.find(baseQuery).sort({ followers_count: -1, createdAt: -1 }).limit(24);

    return ok(res, { data: { users: serializeListedUsers(allUsers) }, users: serializeListedUsers(allUsers) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const followUser = async (req, res) => {
  try {
    const { id } = req.body;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid follow target" });
    }
    if (!id || String(id) === String(req.userId)) {
      return res.status(400).json({ success: false, message: "Invalid follow target" });
    }

    const [user, target] = await Promise.all([User.findById(req.userId), User.findById(id)]);
    if (!user || !target) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const existingFollow = await Follow.findOne({ followerId: req.userId, followingId: id });
    if (!existingFollow) {
      await Follow.create({ followerId: req.userId, followingId: id });
      await Promise.all([
        User.updateOne({ _id: req.userId }, { $inc: { following_count: 1 } }),
        User.updateOne({ _id: id }, { $inc: { followers_count: 1 } }),
        deleteCacheByPrefix(`cache:profile:${String(req.userId)}`),
        deleteCacheByPrefix(`cache:profile:${String(id)}`),
        deleteCacheByPrefix(`cache:profile-connections:${String(req.userId)}`),
        deleteCacheByPrefix(`cache:profile-connections:${String(id)}`),
      ]);
      await createNotification({
        recipientId: id,
        actorId: req.userId,
        type: "follow",
        title: "New follower",
        text: `${user.full_name} started following you.`,
        link: `/app/profile/${req.userId}`,
        entityType: "profile",
        entityId: req.userId,
      });
    }

    return res.json({ success: true, message: "You are following this user" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const unfollowUser = async (req, res) => {
  try {
    const { id } = req.body;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid follow target" });
    }
    const [user, target] = await Promise.all([User.findById(req.userId), User.findById(id)]);

    if (!user || !target) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const deleted = await Follow.deleteOne({ followerId: req.userId, followingId: id });
    if (deleted.deletedCount) {
      await Promise.all([
        User.updateOne({ _id: req.userId }, { $inc: { following_count: -1 } }),
        User.updateOne({ _id: id }, { $inc: { followers_count: -1 } }),
        deleteCacheByPrefix(`cache:profile:${String(req.userId)}`),
        deleteCacheByPrefix(`cache:profile:${String(id)}`),
        deleteCacheByPrefix(`cache:profile-connections:${String(req.userId)}`),
        deleteCacheByPrefix(`cache:profile-connections:${String(id)}`),
      ]);
    }

    return res.json({ success: true, message: "You are no longer following this user" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserConnections = async (req, res) => {
  try {
    const [followersEdges, followingEdges] = await Promise.all([
      Follow.find({ followingId: req.userId }).sort({ createdAt: -1 }).populate("followerId", USER_SUMMARY_FIELDS).lean(),
      Follow.find({ followerId: req.userId }).sort({ createdAt: -1 }).populate("followingId", USER_SUMMARY_FIELDS).lean(),
    ]);

    const followers = serializeListedUsers(followersEdges.map((edge) => edge.followerId).filter(Boolean));
    const following = serializeListedUsers(followingEdges.map((edge) => edge.followingId).filter(Boolean));

    const network = Array.from(new Map([...followers, ...following].map((item) => [String(item._id), item])).values());
    return ok(res, {
      data: { followers, following, network },
      followers,
      following,
      network,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserProfiles = async (req, res) => {
  try {
    const resolvedProfileId = getResolvedProfileId(req);
    const viewerId = String(req.userId);

    if (!isValidObjectId(resolvedProfileId)) {
      return res.status(400).json({ success: false, message: "Invalid profile id" });
    }

    const cacheKey = buildCacheKey("cache", "profile", resolvedProfileId, `viewer=${viewerId}`);
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const profile = await User.findById(resolvedProfileId);
    if (!profile) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    const [posts, reels, followersPreviewEdges, followingPreviewEdges] = await Promise.all([
      Post.find({ user: profile._id, is_reel: false }).populate("user", "full_name username profile_picture").sort({ createdAt: -1 }).limit(12),
      Post.find({ user: profile._id, is_reel: true }).populate("user", "full_name username profile_picture").sort({ createdAt: -1 }).limit(9),
      Follow.find({ followingId: profile._id }).sort({ createdAt: -1 }).limit(8).populate("followerId", USER_SUMMARY_FIELDS).lean(),
      Follow.find({ followerId: profile._id }).sort({ createdAt: -1 }).limit(8).populate("followingId", USER_SUMMARY_FIELDS).lean(),
    ]);
    const enrichedPosts = await enrichPosts(posts, req.userId);
    const enrichedReels = await enrichPosts(reels, req.userId);
    const hydratedProfile = await attachFollowIds(profile);
    const followers = serializeListedUsers(followersPreviewEdges.map((edge) => edge.followerId).filter(Boolean));
    const following = serializeListedUsers(followingPreviewEdges.map((edge) => edge.followingId).filter(Boolean));
    const stats = {
      postCount: await Post.countDocuments({ user: profile._id, is_reel: false }),
      reelCount: await Post.countDocuments({ user: profile._id, is_reel: true }),
      totalContentCount: 0,
      mediaCount: await Post.countDocuments({
        user: profile._id,
        is_reel: false,
        $or: [{ media_type: "image" }, { image_urls: { $exists: true, $ne: [] } }],
      }),
    };
    stats.totalContentCount = stats.postCount + stats.reelCount;

    const payload = {
      success: true,
      profile: serializeUserProfile(hydratedProfile, {
        includeEmail: resolvedProfileId === viewerId,
        includeRelations: resolvedProfileId === viewerId,
      }),
      followers,
      following,
      stats,
      posts: enrichedPosts,
      reels: enrichedReels,
      postsHasMore: stats.postCount > enrichedPosts.length,
      reelsHasMore: stats.reelCount > enrichedReels.length,
      postsNextCursor: enrichedPosts.length ? encodeListCursor(posts[posts.length - 1]) : null,
      reelsNextCursor: enrichedReels.length ? encodeListCursor(reels[reels.length - 1]) : null,
      followersPreview: followers,
      followingPreview: following,
    };
    await setCache(cacheKey, payload, 120);
    return ok(res, payload);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getProfileContent = async (req, res) => {
  try {
    const resolvedProfileId = getResolvedProfileId(req);
    const viewerId = String(req.userId);
    const type = String(req.query.type || "posts");
    const cursor = decodeListCursor(req.query.cursor);
    const limit = parseBoundedInteger(req.query.limit, {
      defaultValue: type === "reels" ? 9 : 12,
      min: 1,
      max: type === "reels" ? 12 : 15,
    });

    if (!isValidObjectId(resolvedProfileId)) {
      return res.status(400).json({ success: false, message: "Invalid profile id" });
    }

    if (!["posts", "reels"].includes(type)) {
      return res.status(400).json({ success: false, message: "Invalid content type" });
    }

    const profile = await User.findById(resolvedProfileId).select("_id");
    if (!profile) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    const cacheKey = buildCacheKey("cache", "profile-content", resolvedProfileId, type, `cursor=${req.query.cursor || "first"}`, `limit=${limit}`, `viewer=${viewerId}`);
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const items = await Post.find({
      user: profile._id,
      is_reel: type === "reels",
      ...buildCursorMatch(cursor),
    })
      .populate("user", "full_name username profile_picture")
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1);

    const hasMore = items.length > limit;
    const pageItems = items.slice(0, limit);
    const enriched = await enrichPosts(pageItems, viewerId);

    const payload = {
      message: "Profile content loaded",
      items: enriched,
      hasMore,
      nextCursor: hasMore && pageItems.length ? encodeListCursor(pageItems[pageItems.length - 1]) : null,
      itemKey: "items",
    };
    await setCache(cacheKey, { success: true, ...payload, data: { items: enriched, hasMore: payload.hasMore, nextCursor: payload.nextCursor }, meta: { hasMore: payload.hasMore, nextCursor: payload.nextCursor, count: enriched.length } }, 90);
    return paginated(res, payload);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getProfileConnectionsPage = async (req, res) => {
  try {
    const resolvedProfileId = getResolvedProfileId(req);
    const type = String(req.query.type || "followers");
    const cursor = decodeListCursor(req.query.cursor);
    const limit = parseBoundedInteger(req.query.limit, { defaultValue: 20, min: 1, max: 40 });

    if (!isValidObjectId(resolvedProfileId)) {
      return res.status(400).json({ success: false, message: "Invalid profile id" });
    }

    if (!["followers", "following"].includes(type)) {
      return res.status(400).json({ success: false, message: "Invalid connection type" });
    }

    const edgeFilter =
      type === "followers"
        ? { followingId: resolvedProfileId, ...buildCursorMatch(cursor) }
        : { followerId: resolvedProfileId, ...buildCursorMatch(cursor) };

    const cacheKey = buildCacheKey("cache", "profile-connections", resolvedProfileId, type, `cursor=${req.query.cursor || "first"}`, `limit=${limit}`);
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const edges = await Follow.find(edgeFilter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate(type === "followers" ? "followerId" : "followingId", USER_SUMMARY_FIELDS)
      .lean();

    const hasMore = edges.length > limit;
    const pageEdges = edges.slice(0, limit);
    const users = serializeListedUsers(
      pageEdges.map((edge) => (type === "followers" ? edge.followerId : edge.followingId)).filter(Boolean)
    );

    const payload = {
      message: "Profile connections loaded",
      items: users,
      hasMore,
      nextCursor: hasMore && pageEdges.length ? encodeListCursor(pageEdges[pageEdges.length - 1]) : null,
      itemKey: "users",
    };
    await setCache(cacheKey, { success: true, ...payload, users, data: { items: users, hasMore: payload.hasMore, nextCursor: payload.nextCursor }, meta: { hasMore: payload.hasMore, nextCursor: payload.nextCursor, count: users.length } }, 60);
    return paginated(res, payload);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
