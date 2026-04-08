import fs from "fs";
import imagekit from "../configs/imagekit.js";
import Comment from "../models/Comment.js";
import Follow from "../models/Follow.js";
import Post from "../models/Post.js";
import PostReaction from "../models/PostReaction.js";
import User from "../models/User.js";

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
  const fileBuffer = fs.readFileSync(file.path);
  const response = await imagekit.upload({
    file: fileBuffer,
    fileName: file.originalname,
    folder,
  });

  const isVideo = file.mimetype.startsWith("video");
  const isImage = file.mimetype.startsWith("image");

  return {
    url: response.url,
    transformedUrl: isVideo || !isImage
      ? response.url
      : imagekit.url({
          path: response.filePath,
          transformation: [
            { quality: "auto" },
            { format: "webp" },
            { width: "1280" },
          ],
        }),
    thumbnail: isVideo ?
     response.thumbnailUrl || response.url
     : imagekit.url({
          path: response.filePath,
          transformation: [{ width: "400" }],
        }),
  };
};

const decoratePost = (post, reactionTypes = new Set()) => {
  const normalized = post.toObject?.() || post;
  return {
    ...normalized,
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

const loadFeedPosts = async ({ viewerId, isReel = false }) => {
  const viewer = await getViewerGraph(viewerId);
  const followingIds = viewer?.followingIds || new Set();

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

  const posts = await Post.find(filter).populate("user").sort({ createdAt: -1 }).limit(isReel ? 40 : 60);
  return sortByAudiencePriority(posts, viewer);
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
    const parsedDuration = Number(duration_seconds || 0);
    const normalizedContent = String(content || "").trim();
    const normalizedCaption = String(caption || "").trim();
    const resolvedContent = reelMode ? normalizedContent : (normalizedContent || normalizedCaption);
    const resolvedCaption = reelMode ? (normalizedCaption || normalizedContent) : (normalizedCaption || normalizedContent);

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

    const populated = await created.populate("user");
    return res.json({ success: true, post: await enrichPost(populated, req.userId), message: "Post created successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getFeedPosts = async (req, res) => {
  try {
    const posts = await loadFeedPosts({ viewerId: req.userId, isReel: false });
    return res.json({ success: true, posts: await enrichPosts(posts, req.userId) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPublicFeedPosts = async (req, res) => {
  try {
    const posts = await loadFeedPosts({ viewerId: null, isReel: false });
    return res.json({ success: true, posts: await enrichPosts(posts, null) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getReelsFeed = async (req, res) => {
  try {
    const reels = await loadFeedPosts({ viewerId: req.userId, isReel: true });
    return res.json({ success: true, reels: await enrichPosts(reels, req.userId) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPublicReels = async (req, res) => {
  try {
    const { category, sub_category, target_audience, cursor } = req.query;
    const limit = 12;
    const filter = {
      is_reel: true,
      visibility: "public",
      ...(category ? { category } : {}),
      ...(sub_category ? { sub_category } : {}),
      ...(target_audience ? { target_audience } : {}),
      ...(cursor ? { createdAt: { $lt: new Date(cursor) } } : {}),
    };

    const reels = await Post.find(filter).populate("user").sort({ createdAt: -1 }).limit(limit + 1);
    const hasMore = reels.length > limit;
    const items = await enrichPosts(reels.slice(0, limit), null);

    return res.json({
      success: true,
      reels: items,
      nextCursor: hasMore ? items[items.length - 1]?.createdAt : null,
      hasMore,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const likePost = async (req, res) => {
  try {
    const { postId } = req.body;
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

    const updatedPost = await Post.findById(postId).populate("user");
    return res.json({ success: true, message: existing ? "Post unliked" : "Post liked", post: await enrichPost(updatedPost, req.userId) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const commentOnPost = async (req, res) => {
  try {
    const { postId, text } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ success: false, message: "Comment text is required" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    await Comment.create({
      post: postId,
      user: req.userId,
      text: text.trim(),
      liked_by: [],
      likes_count: 0,
    });

    await post.populate("user");

    return res.json({ success: true, message: "Comment added", post: await enrichPost(post, req.userId) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const sharePost = async (req, res) => {
  try {
    const { postId } = req.body;
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    const existing = await PostReaction.findOne({ postId, userId: req.userId, type: "share" });
    if (!existing) {
      await PostReaction.create({ postId, userId: req.userId, type: "share" });
      await Post.updateOne({ _id: postId }, { $inc: { shares_count: 1 } });
    }

    const updatedPost = await Post.findById(postId).populate("user");
    return res.json({ success: true, message: "Share recorded", post: await enrichPost(updatedPost, req.userId) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deletePost = async (req, res) => {
  try {
    const { postId } = req.body;
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

    return res.json({ success: true, message: post.is_reel ? "Reel deleted" : "Post deleted" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const savePost = async (req, res) => {
  try {
    const { postId } = req.body;
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

    const updatedPost = await Post.findById(postId).populate("user");
    return res.json({ success: true, message: existing ? "Post removed from saved" : "Post saved", post: await enrichPost(updatedPost, req.userId) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const replyToComment = async (req, res) => {
  try {
    const { postId, commentId, text } = req.body;
    if (!text?.trim()) {
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
      text: text.trim(),
      liked_by: [],
      likes_count: 0,
    });

    await post.populate("user");

    return res.json({ success: true, message: "Reply added", post: await enrichPost(post, req.userId) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const likeComment = async (req, res) => {
  try {
    const { postId, commentId } = req.body;
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
    await post.populate("user");

    return res.json({ success: true, message: alreadyLiked ? "Comment unliked" : "Comment liked", post: await enrichPost(post, req.userId) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteComment = async (req, res) => {
  try {
    const { postId, commentId } = req.body;
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
    await post.populate("user");

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
    const post = await Post.findOneAndUpdate({ _id: postId, is_reel: true }, { $inc: { view_count: 1 } }, { new: true });
    if (!post) {
      return res.status(404).json({ success: false, message: "Reel not found" });
    }
    return res.json({ success: true, view_count: post.view_count });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
