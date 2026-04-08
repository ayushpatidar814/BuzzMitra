import fs from "fs";
import crypto from "crypto";
import Follow from "../models/Follow.js";
import User from "../models/User.js";
import imagekit from "../configs/imagekit.js";
import Post from "../models/Post.js";
import { enrichPost, enrichPosts } from "./postController.js";
import {
  createPasswordHash,
  createUsernameFromIdentity,
  signAuthToken,
  verifyPassword,
} from "../utils/auth.js";
import { serializeUser } from "../utils/serialize.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const USER_SUMMARY_FIELDS = "email full_name username bio profile_picture cover_photo location followers_count following_count account_visibility role preferences createdAt updatedAt";

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

const uploadAsset = async (file, folder, width) => {
  const buffer = fs.readFileSync(file.path);
  const response = await imagekit.upload({
    file: buffer,
    fileName: file.originalname,
    folder,
  });

  return imagekit.url({
    path: response.filePath,
    transformation: [
      { quality: "auto" },
      { format: "webp" },
      ...(width ? [{ width: String(width) }] : []),
    ],
  });
};

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
  const [followingEdges, followerEdges] = await Promise.all([
    Follow.find({ followerId: user._id }).select("followingId").lean(),
    Follow.find({ followingId: user._id }).select("followerId").lean(),
  ]);

  user.following = followingEdges.map((edge) => String(edge.followingId));
  user.followers = followerEdges.map((edge) => String(edge.followerId));
  user.following_count = typeof user.following_count === "number" ? user.following_count : user.following.length;
  user.followers_count = typeof user.followers_count === "number" ? user.followers_count : user.followers.length;
  return user;
};

const serializeListedUsers = (users = []) =>
  users.map((userDoc) =>
    serializeUser({
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
    user: serializeUser(user),
  });
};

export const registerUser = async (req, res) => {
  try {
    const { email, password, full_name, username } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ success: false, message: "Email, password and full name are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ success: false, message: "An account already exists with this email" });
    }

    const uniqueUsername = await ensureUniqueUsername(username || normalizedEmail.split("@")[0]);
    const { salt, passwordHash } = createPasswordHash(password);

    const user = await User.create({
      email: normalizedEmail,
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
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase().trim() });
    
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
    return res.json({ success: true, user: serializeUser(await attachFollowIds(user)) });
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
      user.profile_picture = await uploadAsset(profile, "profiles", 512);
    }

    if (cover) {
      user.cover_photo = await uploadAsset(cover, "covers", 1280);
    }

    await user.save();

    return res.json({ success: true, user: serializeUser(await attachFollowIds(user)), message: "Profile updated successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const discoverUsers = async (req, res) => {
  try {
    const { input = "" } = req.body;
    const trimmed = input.trim();
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

    return res.json({ success: true, users: serializeListedUsers(allUsers) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const followUser = async (req, res) => {
  try {
    const { id } = req.body;
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
      ]);
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
    const [user, target] = await Promise.all([User.findById(req.userId), User.findById(id)]);

    if (!user || !target) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const deleted = await Follow.deleteOne({ followerId: req.userId, followingId: id });
    if (deleted.deletedCount) {
      await Promise.all([
        User.updateOne({ _id: req.userId }, { $inc: { following_count: -1 } }),
        User.updateOne({ _id: id }, { $inc: { followers_count: -1 } }),
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

    return res.json({
      success: true,
      followers,
      following,
      network: Array.from(new Map([...followers, ...following].map((item) => [String(item._id), item])).values()),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserProfiles = async (req, res) => {
  try {
    const { profileId } = req.body;
    const profile = await User.findById(profileId || req.userId);
    if (!profile) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    const [posts, reels, followersEdges, followingEdges] = await Promise.all([
      Post.find({ user: profile._id, is_reel: false }).populate("user").sort({ createdAt: -1 }),
      Post.find({ user: profile._id, is_reel: true }).populate("user").sort({ createdAt: -1 }),
      Follow.find({ followingId: profile._id }).sort({ createdAt: -1 }).populate("followerId", USER_SUMMARY_FIELDS).lean(),
      Follow.find({ followerId: profile._id }).sort({ createdAt: -1 }).populate("followingId", USER_SUMMARY_FIELDS).lean(),
    ]);
    const enrichedPosts = await enrichPosts(posts, req.userId);
    const enrichedReels = await enrichPosts(reels, req.userId);
    const hydratedProfile = await attachFollowIds(profile);
    const followers = serializeListedUsers(followersEdges.map((edge) => edge.followerId).filter(Boolean));
    const following = serializeListedUsers(followingEdges.map((edge) => edge.followingId).filter(Boolean));

    return res.json({
      success: true,
      profile: serializeUser(hydratedProfile),
      followers,
      following,
      stats: {
        postCount: enrichedPosts.length,
        reelCount: enrichedReels.length,
        totalContentCount: enrichedPosts.length + enrichedReels.length,
        mediaCount: enrichedPosts.filter((post) => (post.image_urls || []).length > 0 || post.media_type === "image").length,
      },
      posts: enrichedPosts,
      reels: enrichedReels,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
