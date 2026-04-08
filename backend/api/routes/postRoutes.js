import express from 'express';
import { upload } from '../configs/multer.js';
import { protect } from '../middlewares/auth.js';
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
} from '../controllers/postController.js';

const postRouter = express.Router()

postRouter.post('/add', upload.fields([{ name: 'images', maxCount: 4 }, { name: 'music_file', maxCount: 1 }]), protect, addPost)
postRouter.get('/feed', protect, getFeedPosts);
postRouter.get('/feed/public', getPublicFeedPosts);
postRouter.get('/reels/feed', protect, getReelsFeed);
postRouter.get('/reels/public', getPublicReels);
postRouter.post('/like', protect, likePost);
postRouter.post('/comment', protect, commentOnPost);
postRouter.post('/comment/reply', protect, replyToComment);
postRouter.post('/comment/like', protect, likeComment);
postRouter.post('/comment/delete', protect, deleteComment);
postRouter.post('/share', protect, sharePost);
postRouter.post('/save', protect, savePost);
postRouter.post('/delete', protect, deletePost);
postRouter.post('/reels/view', trackReelView);

export default postRouter
