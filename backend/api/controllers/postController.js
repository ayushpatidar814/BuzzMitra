import Comment from "../models/Comment.js";
import Follow from "../models/Follow.js";
import Post from "../models/Post.js";
import PostReaction from "../models/PostReaction.js";
import User from "../models/User.js";
import { uploadOptimizedMedia } from "../utils/media.js";
import mongoose from "mongoose";
import { buildCacheKey, deleteCacheByPrefix, getCache, setCache } from "../utils/cache.js";
import { bufferReelView, bufferReelWatchTime } from "../utils/engagementBuffer.js";
import { isValidObjectId, parseBoundedInteger, trimString } from "../utils/request.js";
import { paginated } from "../utils/response.js";
import { createNotification } from "../services/notification.service.js";

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm", "video/x-matroska"]);

const normalizeUserSummary = (user) =>
  user
    ? {
        _id: String(user._id),
        full_name: user.full_name,
        username: user.username,
        profile_picture: user.profile_picture,
      }
    : null;

const buildCommentTree = (commentDocs = [], currentUserId) => {
  const nodes = new Map();

  commentDocs.forEach((comment) => {
    nodes.set(String(comment._id), {
      _id: String(comment._id),
      post: String(comment.post),
      parentComment: comment.parentComment ? String(comment.parentComment) : null,
      user: normalizeUserSummary(comment.user),
      text: comment.text,
      mentions: comment.mentions || [],
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      likeCount: comment.likes_count ?? comment.liked_by?.length ?? 0,
      isLiked: currentUserId
        ? (comment.liked_by || []).some((id) => String(id) === String(currentUserId))
        : false,
      replies: [],
    });
  });

  const roots = [];
  nodes.forEach((node) => {
    if (node.parentComment && nodes.has(node.parentComment)) {
      nodes.get(node.parentComment).replies.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
};

const fetchCommentsForPosts = async (postIds = [], currentUserId) => {
  if (!postIds.length) return new Map();
  const comments = await Comment.find({ post: { $in: postIds } })
    .populate("user", "full_name username profile_picture")
    .sort({ createdAt: 1 })
    .lean();

  const grouped = comments.reduce((acc, comment) => {
    const key = String(comment.post);
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key).push(comment);
    return acc;
  }, new Map());

  const trees = new Map();
  postIds.forEach((postId) => {
    trees.set(String(postId), buildCommentTree(grouped.get(String(postId)) || [], currentUserId));
  });
  return trees;
};

const fetchReactionFlags = async (postIds = [], currentUserId) => {
  if (!currentUserId || !postIds.length) return new Map();
  const reactions = await PostReaction.find({
    postId: { $in: postIds },
    userId: currentUserId,
    type: { $in: ["like", "save"] },
  })
    .select("postId type")
    .lean();

  return reactions.reduce((acc, reaction) => {
    const key = String(reaction.postId);
    if (!acc.has(key)) acc.set(key, new Set());
    acc.get(key).add(reaction.type);
    return acc;
  }, new Map());
};

const uploadMedia = async (file, folder = "posts") => {
  const uploaded = await uploadOptimizedMedia(file, folder, file.originalname);
  return {
    url: uploaded.url,
    originalUrl: uploaded.originalUrl,
    transformedUrl: uploaded.url,
    thumbnail: uploaded.thumbnail,
  };
};

const decoratePost = (post, reactionTypes = new Set()) => {
  const normalized = post.toObject?.() || post;
  return {
    ...normalized,
    user: normalizeUserSummary(normalized.user),
    likeCount: normalized.likes_count ?? 0,
    shareCount: normalized.shares_count ?? 0,
    saveCount: normalized.saves_count ?? 0,
    isLiked: reactionTypes.has("like"),
    isSaved: reactionTypes.has("save"),
  };
};

const flattenCommentCount = (comments = []) =>
  comments.reduce((total, comment) => total + 1 + flattenCommentCount(comment.replies || []), 0);

export const enrichPosts = async (posts, currentUserId) => {
  const postIds = posts.map((post) => String(post._id));
  const [commentMap, reactionMap] = await Promise.all([
    fetchCommentsForPosts(postIds, currentUserId),
    fetchReactionFlags(postIds, currentUserId),
  ]);

  return posts.map((post) => {
    const comments = commentMap.get(String(post._id)) || [];
    return {
      ...decoratePost(post, reactionMap.get(String(post._id)) || new Set()),
      comments,
      commentCount: flattenCommentCount(comments),
    };
  });
};

export const enrichPost = async (post, currentUserId) => (await enrichPosts([post], currentUserId))[0];

const getAudiencePriority = (post, viewer) => {
  if (!viewer) return 3;
  const authorId = String(post.user?._id || post.user);
  const viewerId = String(viewer._id);
  const following = viewer.followingIds || new Set();
  const followers = viewer.followerIds || new Set();

  if (authorId === viewerId) return 0;
  if (following.has(authorId)) return 1;
  if (followers.has(authorId)) return 2;
  return 3;
};

const sortByAudiencePriority = (posts, viewer) =>
  [...posts].sort((left, right) => {
    const priorityGap = getAudiencePriority(left, viewer) - getAudiencePriority(right, viewer);
    if (priorityGap !== 0) return priorityGap;
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });

const encodeFeedCursor = (post) =>
  Buffer.from(
    JSON.stringify({
      priority: Number(post.audiencePriority ?? 3),
      createdAt: post.createdAt,
      id: String(post._id),
    })
  ).toString("base64");

const decodeFeedCursor = (cursor) => {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
    if (!parsed?.createdAt || !parsed?.id) return null;
    return {
      priority: Number(parsed.priority ?? 3),
      createdAt: new Date(parsed.createdAt),
      id: new mongoose.Types.ObjectId(parsed.id),
    };
  } catch {
    return null;
  }
};

const encodeRecommendationCursor = (post) =>
  Buffer.from(
    JSON.stringify({
      score: Number(post.recommendationScore ?? 0),
      createdAt: post.createdAt,
      id: String(post._id),
    })
  ).toString("base64");

const decodeRecommendationCursor = (cursor) => {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
    if (!parsed?.createdAt || !parsed?.id) return null;
    return {
      score: Number(parsed.score ?? 0),
      createdAt: new Date(parsed.createdAt),
      id: new mongoose.Types.ObjectId(parsed.id),
    };
  } catch {
    return null;
  }
};

const invalidatePostCaches = async ({ authorId } = {}) => {
  await deleteCacheByPrefix(
    "cache:feed:public",
    "cache:reels:public",
    authorId ? `cache:profile:${authorId}` : null,
    authorId ? `cache:profile-content:${authorId}` : null
  );
};

const getViewerGraph = async (viewerId) => {
  if (!viewerId) return null;
  const viewer = await User.findById(viewerId).lean();
  if (!viewer) return null;

  const [followingEdges, followerEdges] = await Promise.all([
    Follow.find({ followerId: viewerId }).select("followingId").lean(),
    Follow.find({ followingId: viewerId }).select("followerId").lean(),
  ]);

  return {
    ...viewer,
    followingIds: new Set(followingEdges.map((edge) => String(edge.followingId))),
    followerIds: new Set(followerEdges.map((edge) => String(edge.followerId))),
  };
};

const getReelInterestProfile = async (viewerId) => {
  const viewer = await getViewerGraph(viewerId);
  if (!viewer) {
    return {
      viewer: null,
      categories: [],
      subcategories: [],
      audiences: [],
    };
  }

  const preferenceCategories = viewer.preferences?.reel_categories || [];
  const preferenceSubcategories = viewer.preferences?.reel_subcategories || [];
  const preferenceAudiences = viewer.preferences?.target_audiences || [];

  const recentReactions = await PostReaction.find({
    userId: viewerId,
    type: { $in: ["like", "save", "share"] },
  })
    .sort({ createdAt: -1 })
    .limit(40)
    .select("postId")
    .lean();

  const reactedPostIds = recentReactions.map((reaction) => reaction.postId);
  const reactedPosts = reactedPostIds.length
    ? await Post.find({ _id: { $in: reactedPostIds }, is_reel: true })
        .select("category sub_category target_audience")
        .lean()
    : [];

  const categories = new Set(preferenceCategories.filter(Boolean));
  const subcategories = new Set(preferenceSubcategories.filter(Boolean));
  const audiences = new Set(preferenceAudiences.filter(Boolean));

  reactedPosts.forEach((post) => {
    if (post.category) categories.add(post.category);
    if (post.sub_category) subcategories.add(post.sub_category);
    if (post.target_audience) audiences.add(post.target_audience);
  });

  return {
    viewer,
    categories: [...categories],
    subcategories: [...subcategories],
    audiences: [...audiences],
  };
};

const loadFeedPosts = async ({ viewerId, isReel = false, cursor, limit = 12 }) => {
  const viewer = await getViewerGraph(viewerId);
  const followingIds = viewer?.followingIds || new Set();
  const followerIds = viewer?.followerIds || new Set();
  const parsedLimit = parseBoundedInteger(limit, { defaultValue: 12, min: 1, max: isReel ? 18 : 15 });
  const parsedCursor = decodeFeedCursor(cursor);

  const filter = viewer
    ? {
        is_reel: isReel,
        $or: [
          { visibility: "public" },
          { user: viewer._id },
          { visibility: "followers", user: { $in: Array.from(followingIds) } },
        ],
      }
    : {
        is_reel: isReel,
        visibility: "public",
      };

  const pipeline = [{ $match: filter }];

  if (viewer) {
    pipeline.push({
      $addFields: {
        audiencePriority: {
          $switch: {
            branches: [
              {
                case: { $eq: ["$user", new mongoose.Types.ObjectId(String(viewer._id))] },
                then: 0,
              },
              {
                case: {
                  $in: [
                    "$user",
                    Array.from(followingIds).map((id) => new mongoose.Types.ObjectId(String(id))),
                  ],
                },
                then: 1,
              },
              {
                case: {
                  $in: [
                    "$user",
                    Array.from(followerIds).map((id) => new mongoose.Types.ObjectId(String(id))),
                  ],
                },
                then: 2,
              },
            ],
            default: 3,
          },
        },
      },
    });
  } else {
    pipeline.push({ $addFields: { audiencePriority: 3 } });
  }

  if (parsedCursor) {
    pipeline.push({
      $match: {
        $or: [
          { audiencePriority: { $gt: parsedCursor.priority } },
          { audiencePriority: parsedCursor.priority, createdAt: { $lt: parsedCursor.createdAt } },
          {
            audiencePriority: parsedCursor.priority,
            createdAt: parsedCursor.createdAt,
            _id: { $lt: parsedCursor.id },
          },
        ],
      },
    });
  }

  pipeline.push(
    { $sort: { audiencePriority: 1, createdAt: -1, _id: -1 } },
    { $limit: parsedLimit + 1 },
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" }
  );

  const posts = await Post.aggregate(pipeline);
  const hasMore = posts.length > parsedLimit;
  const items = posts.slice(0, parsedLimit);

  return {
    items,
    hasMore,
    nextCursor: hasMore && items.length ? encodeFeedCursor(items[items.length - 1]) : null,
  };
};

const loadRecommendedReels = async ({ viewerId, cursor, limit = 8 }) => {
  const { viewer, categories, subcategories, audiences } = await getReelInterestProfile(viewerId);
  const followingIds = viewer?.followingIds || new Set();
  const followerIds = viewer?.followerIds || new Set();
  const parsedLimit = parseBoundedInteger(limit, { defaultValue: 8, min: 1, max: 12 });
  const parsedCursor = decodeRecommendationCursor(cursor);
  const viewerObjectId = viewer?._id ? new mongoose.Types.ObjectId(String(viewer._id)) : null;
  const followingObjectIds = Array.from(followingIds).map((id) => new mongoose.Types.ObjectId(String(id)));
  const followerObjectIds = Array.from(followerIds).map((id) => new mongoose.Types.ObjectId(String(id)));

  const filter = viewer
    ? {
        is_reel: true,
        $or: [
          { visibility: "public" },
          { user: viewer._id },
          { visibility: "followers", user: { $in: Array.from(followingIds) } },
        ],
      }
    : {
        is_reel: true,
        visibility: "public",
      };

  const pipeline = [
    { $match: filter },
    {
      $addFields: {
        audiencePriority: viewer
          ? {
              $switch: {
                branches: [
                  {
                    case: { $eq: ["$user", viewerObjectId] },
                    then: 0,
                  },
                  {
                    case: { $in: ["$user", followingObjectIds] },
                    then: 1,
                  },
                  {
                    case: { $in: ["$user", followerObjectIds] },
                    then: 2,
                  },
                ],
                default: 3,
              },
            }
          : 3,
        categoryMatch: categories.length ? { $cond: [{ $in: ["$category", categories] }, 1, 0] } : 0,
        subcategoryMatch: subcategories.length ? { $cond: [{ $in: ["$sub_category", subcategories] }, 1, 0] } : 0,
        audienceMatch: audiences.length ? { $cond: [{ $in: ["$target_audience", audiences] }, 1, 0] } : 0,
      },
    },
    {
      $addFields: {
        averageWatchSeconds: {
          $cond: [
            { $gt: ["$watch_sessions_count", 0] },
            { $divide: ["$watch_time_total", "$watch_sessions_count"] },
            0,
          ],
        },
      },
    },
    {
      $addFields: {
        watchCompletionScore: {
          $cond: [
            { $and: [{ $gt: ["$duration_seconds", 0] }, { $gt: ["$averageWatchSeconds", 0] }] },
            {
              $min: [
                {
                  $divide: ["$averageWatchSeconds", { $max: ["$duration_seconds", 1] }],
                },
                1.25,
              ],
            },
            0,
          ],
        },
        engagementScore: {
          $add: [
            { $multiply: [{ $sqrt: { $max: ["$likes_count", 0] } }, 18] },
            { $multiply: [{ $sqrt: { $max: ["$shares_count", 0] } }, 20] },
            { $multiply: [{ $sqrt: { $max: ["$saves_count", 0] } }, 16] },
            { $multiply: [{ $sqrt: { $max: ["$view_count", 0] } }, 6] },
          ],
        },
        freshnessBoost: {
          $max: [
            0,
            {
              $subtract: [
                80,
                {
                  $divide: [{ $subtract: ["$$NOW", "$createdAt"] }, 1000 * 60 * 60 * 6],
                },
              ],
            },
          ],
        },
      },
    },
    {
      $addFields: {
        recommendationScore: {
          $add: [
            {
              $switch: {
                branches: [
                  { case: { $eq: ["$audiencePriority", 0] }, then: 280 },
                  { case: { $eq: ["$audiencePriority", 1] }, then: 220 },
                  { case: { $eq: ["$audiencePriority", 2] }, then: 160 },
                ],
                default: 110,
              },
            },
            { $multiply: ["$categoryMatch", 70] },
            { $multiply: ["$subcategoryMatch", 45] },
            { $multiply: ["$audienceMatch", 35] },
            { $multiply: ["$watchCompletionScore", 90] },
            "$engagementScore",
            "$freshnessBoost",
          ],
        },
      },
    },
  ];

  if (parsedCursor) {
    pipeline.push({
      $match: {
        $or: [
          { recommendationScore: { $lt: parsedCursor.score } },
          { recommendationScore: parsedCursor.score, createdAt: { $lt: parsedCursor.createdAt } },
          {
            recommendationScore: parsedCursor.score,
            createdAt: parsedCursor.createdAt,
            _id: { $lt: parsedCursor.id },
          },
        ],
      },
    });
  }

  pipeline.push(
    { $sort: { recommendationScore: -1, createdAt: -1, _id: -1 } },
    { $limit: parsedLimit + 1 },
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" }
  );

  const reels = await Post.aggregate(pipeline);
  const hasMore = reels.length > parsedLimit;
  const items = reels.slice(0, parsedLimit);

  return {
    items,
    hasMore,
    nextCursor: hasMore && items.length ? encodeRecommendationCursor(items[items.length - 1]) : null,
  };
};

export const addPost = async (req, res) => {
  try {
    const {
      content = "",
      caption = "",
      post_type,
      visibility = "public",
      is_reel = "false",
      duration_seconds = 0,
      category = "",
      sub_category = "",
      target_audience = "",
      reel_emojis = "",
      gif_url = "",
      music_title = "",
      music_artist = "",
      music_url = "",
    } = req.body;

    const images = Array.isArray(req.files) ? req.files : req.files?.images || [];
    const musicFile = Array.isArray(req.files) ? null : req.files?.music_file?.[0] || null;
    const reelMode = is_reel === "true" || post_type === "reel";
    const parsedDuration = parseBoundedInteger(duration_seconds, { defaultValue: 0, min: 0, max: 45 });
    const normalizedContent = trimString(content, { maxLength: 2200 });
    const normalizedCaption = trimString(caption, { maxLength: 2200 });
    const resolvedContent = reelMode ? normalizedContent : (normalizedContent || normalizedCaption);
    const resolvedCaption = reelMode ? (normalizedCaption || normalizedContent) : (normalizedCaption || normalizedContent);

    if (!["public", "followers", "private", "connections"].includes(String(visibility || ""))) {
      return res.status(400).json({ success: false, message: "Invalid visibility option" });
    }

    if (!reelMode && !["text", "image", "text_with_image"].includes(String(post_type || ""))) {
      return res.status(400).json({ success: false, message: "Invalid post type" });
    }

    if (!reelMode && !resolvedContent && !images.length) {
      return res.status(400).json({ success: false, message: "Add text or an image to create a post" });
    }

    if (!reelMode && images.some((file) => !IMAGE_MIME_TYPES.has(file.mimetype))) {
      return res.status(400).json({ success: false, message: "Posts currently support image uploads only" });
    }

    if (reelMode) {
      if (images.length !== 1) {
        return res.status(400).json({ success: false, message: "A reel must include exactly one video file" });
      }

      if (!VIDEO_MIME_TYPES.has(images[0].mimetype)) {
        return res.status(400).json({ success: false, message: "Reels must be uploaded as a supported video file" });
      }
    }

    if (reelMode && parsedDuration > 45) {
      return res.status(400).json({ success: false, message: "Reel duration must be 45 seconds or less" });
    }

    const [uploaded, uploadedMusic] = await Promise.all([
      Promise.all(images.map((file) => uploadMedia(file, reelMode ? "reels" : "posts"))),
      musicFile ? uploadMedia(musicFile, "reel-music") : Promise.resolve(null),
    ]);
    const firstMedia = uploaded[0];

    const created = await Post.create({
      user: req.userId,
      content: resolvedContent,
      caption: resolvedCaption,
      image_urls: reelMode ? [] : uploaded.map((item) => item.transformedUrl),
      media_url: reelMode ? firstMedia?.url : firstMedia?.transformedUrl,
      thumbnail_url: firstMedia?.thumbnail || "",
      media_type: reelMode ? "video" : uploaded.length ? "image" : "none",
      post_type: reelMode ? "reel" : post_type,
      is_reel: reelMode,
      duration_seconds: reelMode ? parsedDuration : 0,
      category,
      sub_category,
      target_audience,
      reel_emojis: String(reel_emojis || "").trim(),
      gif_url: String(gif_url || "").trim(),
      music: {
        title: String(music_title || "").trim(),
        artist: String(music_artist || "").trim(),
        url: uploadedMusic?.url || String(music_url || "").trim(),
      },
      visibility: visibility === "connections" ? "followers" : visibility,
    });

    const populated = await created.populate("user", "full_name username profile_picture");
    await invalidatePostCaches({ authorId: req.userId });
    return res.json({ success: true, post: await enrichPost(populated, req.userId), message: "Post created successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getFeedPosts = async (req, res) => {
  try {
    const { cursor, limit } = req.query;
    const { items, hasMore, nextCursor } = await loadFeedPosts({ viewerId: req.userId, isReel: false, cursor, limit });
    return paginated(res, { itemKey: "posts", items: await enrichPosts(items, req.userId), hasMore, nextCursor, message: "Feed loaded" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPublicFeedPosts = async (req, res) => {
  try {
    const { cursor, limit } = req.query;
    const cacheKey = buildCacheKey("cache", "feed", "public", `cursor=${cursor || "first"}`, `limit=${limit || 12}`);
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const { items, hasMore, nextCursor } = await loadFeedPosts({ viewerId: null, isReel: false, cursor, limit });
    const enrichedItems = await enrichPosts(items, null);
    const payload = { success: true, posts: enrichedItems, hasMore, nextCursor, data: { items: enrichedItems, hasMore, nextCursor }, meta: { count: enrichedItems.length, hasMore, nextCursor } };
    await setCache(cacheKey, payload, 90);
    return res.json(payload);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getReelsFeed = async (req, res) => {
  try {
    const { items, hasMore, nextCursor } = await loadRecommendedReels({
      viewerId: req.userId,
      cursor: req.query.cursor,
      limit: req.query.limit || 8,
    });
    return paginated(res, { itemKey: "reels", items: await enrichPosts(items, req.userId), hasMore, nextCursor, message: "Reels loaded" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPublicReels = async (req, res) => {
  try {
    const { category, sub_category, target_audience, cursor } = req.query;
    const limit = 12;
    if (cursor && Number.isNaN(new Date(cursor).getTime())) {
      return res.status(400).json({ success: false, message: "Invalid reels cursor" });
    }
    const cacheKey = buildCacheKey(
      "cache",
      "reels",
      "public",
      `category=${category || "all"}`,
      `sub=${sub_category || "all"}`,
      `audience=${target_audience || "all"}`,
      `cursor=${cursor || "first"}`
    );
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    const filter = {
      is_reel: true,
      visibility: "public",
      ...(category ? { category } : {}),
      ...(sub_category ? { sub_category } : {}),
      ...(target_audience ? { target_audience } : {}),
      ...(cursor ? { createdAt: { $lt: new Date(cursor) } } : {}),
    };

    const reels = await Post.find(filter).populate("user", "full_name username profile_picture").sort({ createdAt: -1 }).limit(limit + 1);
    const hasMore = reels.length > limit;
    const items = await enrichPosts(reels.slice(0, limit), null);

    const payload = {
      success: true,
      reels: items,
      nextCursor: hasMore ? items[items.length - 1]?.createdAt : null,
      hasMore,
      data: { items, hasMore, nextCursor: hasMore ? items[items.length - 1]?.createdAt : null },
      meta: { count: items.length, hasMore, nextCursor: hasMore ? items[items.length - 1]?.createdAt : null },
    };
    await setCache(cacheKey, payload, 90);
    return res.json(payload);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const likePost = async (req, res) => {
  try {
    const { postId } = req.body;
    if (!isValidObjectId(postId)) {
      return res.status(400).json({ success: false, message: "Invalid post id" });
    }
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    const existing = await PostReaction.findOne({ postId, userId: req.userId, type: "like" });
    if (existing) {
      await PostReaction.deleteOne({ _id: existing._id });
      await Post.updateOne({ _id: postId }, { $inc: { likes_count: -1 } });
    } else {
      await PostReaction.create({ postId, userId: req.userId, type: "like" });
      await Post.updateOne({ _id: postId }, { $inc: { likes_count: 1 } });
    }

    const updatedPost = await Post.findById(postId).populate("user", "full_name username profile_picture");
    await invalidatePostCaches({ authorId: updatedPost?.user?._id || updatedPost?.user });
    if (!existing && updatedPost && String(updatedPost.user?._id || updatedPost.user) !== String(req.userId)) {
      await createNotification({
        recipientId: updatedPost.user?._id || updatedPost.user,
        actorId: req.userId,
        type: "like_post",
        title: "New likes",
        text: `Someone liked your ${updatedPost.is_reel ? "reel" : "post"}.`,
        link: updatedPost.is_reel ? `/app/reels?reel=${updatedPost._id}` : `/app?post=${updatedPost._id}`,
        entityType: "post",
        entityId: updatedPost._id,
        meta: {
          contentLabel: updatedPost.is_reel ? "reel" : "post",
        },
      });
    }
    return res.json({ success: true, message: existing ? "Post unliked" : "Post liked", post: await enrichPost(updatedPost, req.userId) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const commentOnPost = async (req, res) => {
  try {
    const { postId } = req.body;
    const text = trimString(req.body.text, { maxLength: 1000 });
    if (!isValidObjectId(postId)) {
      return res.status(400).json({ success: false, message: "Invalid post id" });
    }
    if (!text) {
      return res.status(400).json({ success: false, message: "Comment text is required" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    await Comment.create({
      post: postId,
      user: req.userId,
      text,
      liked_by: [],
      likes_count: 0,
    });

    await post.populate("user", "full_name username profile_picture");
    await invalidatePostCaches({ authorId: post?.user?._id || post?.user });
    if (String(post.user?._id || post.user) !== String(req.userId)) {
      await createNotification({
        recipientId: post.user?._id || post.user,
        actorId: req.userId,
        type: "comment_post",
        title: "New comment",
        text: text.length > 72 ? `${text.slice(0, 72)}...` : text,
        link: post.is_reel ? `/app/reels?reel=${post._id}` : `/app?post=${post._id}`,
        entityType: "post",
        entityId: post._id,
      });
    }

    return res.json({ success: true, message: "Comment added", post: await enrichPost(post, req.userId) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const sharePost = async (req, res) => {
  try {
    const { postId } = req.body;
    if (!isValidObjectId(postId)) {
      return res.status(400).json({ success: false, message: "Invalid post id" });
    }
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    const existing = await PostReaction.findOne({ postId, userId: req.userId, type: "share" });
    if (!existing) {
      await PostReaction.create({ postId, userId: req.userId, type: "share" });
      await Post.updateOne({ _id: postId }, { $inc: { shares_count: 1 } });
    }

    const updatedPost = await Post.findById(postId).populate("user", "full_name username profile_picture");
    await invalidatePostCaches({ authorId: updatedPost?.user?._id || updatedPost?.user });
    if (!existing && updatedPost && String(updatedPost.user?._id || updatedPost.user) !== String(req.userId)) {
      await createNotification({
        recipientId: updatedPost.user?._id || updatedPost.user,
        actorId: req.userId,
        type: "share_post",
        title: "Your post was shared",
        text: "Someone shared your post.",
        link: updatedPost.is_reel ? `/app/reels?reel=${updatedPost._id}` : `/app?post=${updatedPost._id}`,
        entityType: "post",
        entityId: updatedPost._id,
      });
    }
    return res.json({ success: true, message: "Share recorded", post: await enrichPost(updatedPost, req.userId) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deletePost = async (req, res) => {
  try {
    const { postId } = req.body;
    if (!isValidObjectId(postId)) {
      return res.status(400).json({ success: false, message: "Invalid post id" });
    }
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    if (String(post.user) !== String(req.userId)) {
      return res.status(403).json({ success: false, message: "You can delete only your own posts" });
    }

    await Promise.all([
      Comment.deleteMany({ post: postId }),
      PostReaction.deleteMany({ postId }),
      Post.deleteOne({ _id: postId }),
    ]);
    await invalidatePostCaches({ authorId: post.user });

    return res.json({ success: true, message: post.is_reel ? "Reel deleted" : "Post deleted" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const savePost = async (req, res) => {
  try {
    const { postId } = req.body;
    if (!isValidObjectId(postId)) {
      return res.status(400).json({ success: false, message: "Invalid post id" });
    }
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    const existing = await PostReaction.findOne({ postId, userId: req.userId, type: "save" });
    if (existing) {
      await PostReaction.deleteOne({ _id: existing._id });
      await Post.updateOne({ _id: postId }, { $inc: { saves_count: -1 } });
    } else {
      await PostReaction.create({ postId, userId: req.userId, type: "save" });
      await Post.updateOne({ _id: postId }, { $inc: { saves_count: 1 } });
    }

    const updatedPost = await Post.findById(postId).populate("user", "full_name username profile_picture");
    await invalidatePostCaches({ authorId: updatedPost?.user?._id || updatedPost?.user });
    return res.json({ success: true, message: existing ? "Post removed from saved" : "Post saved", post: await enrichPost(updatedPost, req.userId) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const replyToComment = async (req, res) => {
  try {
    const { postId, commentId } = req.body;
    const text = trimString(req.body.text, { maxLength: 1000 });
    if (!isValidObjectId(postId) || !isValidObjectId(commentId)) {
      return res.status(400).json({ success: false, message: "Invalid comment request" });
    }
    if (!text) {
      return res.status(400).json({ success: false, message: "Reply text is required" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    const targetComment = await Comment.findOne({ _id: commentId, post: postId });
    if (!targetComment) {
      return res.status(404).json({ success: false, message: "Comment not found" });
    }

    await Comment.create({
      post: postId,
      user: req.userId,
      parentComment: commentId,
      text,
      liked_by: [],
      likes_count: 0,
    });

    await post.populate("user", "full_name username profile_picture");
    await invalidatePostCaches({ authorId: post?.user?._id || post?.user });
    if (String(targetComment.user) !== String(req.userId)) {
      await createNotification({
        recipientId: targetComment.user,
        actorId: req.userId,
        type: "reply_comment",
        title: "New reply",
        text: text.length > 72 ? `${text.slice(0, 72)}...` : text,
        link: post.is_reel ? `/app/reels?reel=${post._id}` : `/app?post=${post._id}`,
        entityType: "comment",
        entityId: targetComment._id,
      });
    } else if (String(post.user?._id || post.user) !== String(req.userId)) {
      await createNotification({
        recipientId: post.user?._id || post.user,
        actorId: req.userId,
        type: "reply_comment",
        title: "New reply on your post",
        text: text.length > 72 ? `${text.slice(0, 72)}...` : text,
        link: post.is_reel ? `/app/reels?reel=${post._id}` : `/app?post=${post._id}`,
        entityType: "post",
        entityId: post._id,
      });
    }

    return res.json({ success: true, message: "Reply added", post: await enrichPost(post, req.userId) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const likeComment = async (req, res) => {
  try {
    const { postId, commentId } = req.body;
    if (!isValidObjectId(postId) || !isValidObjectId(commentId)) {
      return res.status(400).json({ success: false, message: "Invalid comment request" });
    }
    const [post, targetComment] = await Promise.all([
      Post.findById(postId),
      Comment.findOne({ _id: commentId, post: postId }),
    ]);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    if (!targetComment) {
      return res.status(404).json({ success: false, message: "Comment not found" });
    }

    const alreadyLiked = (targetComment.liked_by || []).some((id) => String(id) === String(req.userId));
    targetComment.liked_by = alreadyLiked
      ? (targetComment.liked_by || []).filter((id) => String(id) !== String(req.userId))
      : [...(targetComment.liked_by || []), req.userId];
    targetComment.likes_count = targetComment.liked_by.length;
    await targetComment.save();
    await post.populate("user", "full_name username profile_picture");
    await invalidatePostCaches({ authorId: post?.user?._id || post?.user });

    return res.json({ success: true, message: alreadyLiked ? "Comment unliked" : "Comment liked", post: await enrichPost(post, req.userId) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteComment = async (req, res) => {
  try {
    const { postId, commentId } = req.body;
    if (!isValidObjectId(postId) || !isValidObjectId(commentId)) {
      return res.status(400).json({ success: false, message: "Invalid comment request" });
    }
    const [post, targetComment] = await Promise.all([
      Post.findById(postId),
      Comment.findOne({ _id: commentId, post: postId }),
    ]);

    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    if (!targetComment) {
      return res.status(404).json({ success: false, message: "Comment not found" });
    }

    const requesterId = String(req.userId);
    const isCommentOwner = String(targetComment.user) === requesterId;
    const isPostOwner = String(post.user) === requesterId;

    if (!isCommentOwner && !isPostOwner) {
      return res.status(403).json({ success: false, message: "You cannot delete this comment" });
    }

    const commentIdsToDelete = [String(targetComment._id)];
    let cursor = [String(targetComment._id)];

    while (cursor.length) {
      const children = await Comment.find({ parentComment: { $in: cursor } }).select("_id").lean();
      cursor = children.map((item) => String(item._id));
      commentIdsToDelete.push(...cursor);
    }

    await Comment.deleteMany({ _id: { $in: commentIdsToDelete } });
    await post.populate("user", "full_name username profile_picture");
    await invalidatePostCaches({ authorId: post?.user?._id || post?.user });

    return res.json({
      success: true,
      message: "Comment deleted",
      post: await enrichPost(post, req.userId),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const trackReelView = async (req, res) => {
  try {
    const { postId } = req.body;
    if (!isValidObjectId(postId)) {
      return res.status(400).json({ success: false, message: "Invalid reel id" });
    }
    const post = await Post.findOne({ _id: postId, is_reel: true }).select("_id view_count");
    if (!post) {
      return res.status(404).json({ success: false, message: "Reel not found" });
    }
    await bufferReelView(postId);
    return res.json({ success: true, view_count: Number(post.view_count || 0) + 1 });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const trackReelWatchTime = async (req, res) => {
  try {
    const { postId, watchedSeconds } = req.body;
    if (!isValidObjectId(postId)) {
      return res.status(400).json({ success: false, message: "Invalid reel id" });
    }
    const seconds = Math.max(0, Math.min(Number(watchedSeconds || 0), 60));

    if (!postId || !Number.isFinite(seconds) || seconds < 1) {
      return res.status(400).json({ success: false, message: "A valid reel and watch time are required" });
    }

    const post = await Post.findOne({ _id: postId, is_reel: true }).select("_id watch_time_total watch_sessions_count");

    if (!post) {
      return res.status(404).json({ success: false, message: "Reel not found" });
    }

    await bufferReelWatchTime(postId, seconds);
    return res.json({
      success: true,
      watch_time_total: Number(post.watch_time_total || 0) + Math.round(seconds),
      watch_sessions_count: Number(post.watch_sessions_count || 0) + 1,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
