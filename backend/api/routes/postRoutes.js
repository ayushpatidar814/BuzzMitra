import express from 'express';
import { upload } from '../configs/multer.js';
import { protect } from '../middlewares/auth.js';
import { rateLimit } from '../middlewares/rateLimit.js';
import {
  addPost,
  commentOnPost,
  deletePost,
  deleteComment,
  getFeedPosts,
  getPublicFeedPosts,
  getPublicReels,
  getReelsFeed,
  likeComment,
  likePost,
  replyToComment,
  savePost,
  sharePost,
  trackReelView,
  trackReelWatchTime,
} from '../controllers/postController.js';

const postRouter = express.Router()

postRouter.post('/add', upload.fields([{ name: 'images', maxCount: 4 }, { name: 'music_file', maxCount: 1 }]), protect, addPost)
postRouter.get('/feed', protect, rateLimit({ prefix: 'feed-auth', windowMs: 60 * 1000, max: 180 }), getFeedPosts);
postRouter.get('/feed/public', rateLimit({ prefix: 'feed-public', windowMs: 60 * 1000, max: 220 }), getPublicFeedPosts);
postRouter.get('/reels/feed', protect, rateLimit({ prefix: 'reels-auth', windowMs: 60 * 1000, max: 300 }), getReelsFeed);
postRouter.get('/reels/public', rateLimit({ prefix: 'reels-public', windowMs: 60 * 1000, max: 180 }), getPublicReels);
postRouter.post('/like', protect, rateLimit({ prefix: 'post-like', windowMs: 60 * 1000, max: 180 }), likePost);
postRouter.post('/comment', protect, rateLimit({ prefix: 'post-comment', windowMs: 60 * 1000, max: 100 }), commentOnPost);
postRouter.post('/comment/reply', protect, rateLimit({ prefix: 'post-reply', windowMs: 60 * 1000, max: 100 }), replyToComment);
postRouter.post('/comment/like', protect, rateLimit({ prefix: 'comment-like', windowMs: 60 * 1000, max: 300 }), likeComment);
postRouter.post('/comment/delete', protect, rateLimit({ prefix: 'comment-delete', windowMs: 60 * 1000, max: 120 }), deleteComment);
postRouter.post('/share', protect, rateLimit({ prefix: 'post-share', windowMs: 60 * 1000, max: 300 }), sharePost);
postRouter.post('/save', protect, rateLimit({ prefix: 'post-save', windowMs: 60 * 1000, max: 300 }), savePost);
postRouter.post('/delete', protect, deletePost);
postRouter.post('/reels/view', rateLimit({ prefix: 'reels-view', windowMs: 60 * 1000, max: 300 }), trackReelView);
postRouter.post('/reels/watch-time', protect, rateLimit({ prefix: 'reels-watch', windowMs: 60 * 1000, max: 300 }), trackReelWatchTime);

export default postRouter
