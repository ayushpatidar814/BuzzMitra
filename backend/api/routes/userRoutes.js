import express from 'express'
import {
  discoverUsers,
  followUser,
  getProfileConnectionsPage,
  getProfileContent,
  getUserConnections,
  getUserData,
  getUserProfiles,
  loginUser,
  oauthCallback,
  oauthStart,
  registerUser,
  unfollowUser,
  updatedUserData,
} from '../controllers/userController.js'
import { protect } from '../middlewares/auth.js';
import { upload } from '../configs/multer.js';
import { rateLimit } from '../middlewares/rateLimit.js';

const userRouter = express.Router();

userRouter.post('/register', rateLimit({ prefix: 'auth-register', windowMs: 10 * 60 * 1000, max: 20, message: 'Too many registration attempts' }), registerUser)
userRouter.post('/login', rateLimit({ prefix: 'auth-login', windowMs: 10 * 60 * 1000, max: 40, message: 'Too many login attempts' }), loginUser)
userRouter.get('/oauth/:provider', oauthStart)
userRouter.get('/oauth/:provider/callback', oauthCallback)
userRouter.get('/data', protect, getUserData)
userRouter.post('/update', upload.fields([{name: 'profile', maxCount:1}, {name: 'cover', maxCount: 1}]), protect, updatedUserData)
userRouter.post('/discover', protect, rateLimit({ prefix: 'user-discover', windowMs: 60 * 1000, max: 40 }), discoverUsers)
userRouter.post('/follow', protect, rateLimit({ prefix: 'user-follow', windowMs: 60 * 1000, max: 50 }), followUser)
userRouter.post('/unfollow', protect, rateLimit({ prefix: 'user-unfollow', windowMs: 60 * 1000, max: 50 }), unfollowUser)
userRouter.get('/connections', protect, rateLimit({ prefix: 'user-connections', windowMs: 60 * 1000, max: 30 }), getUserConnections)
userRouter.post('/profiles', protect, rateLimit({ prefix: 'user-profile', windowMs: 60 * 1000, max: 40 }), getUserProfiles)
userRouter.get('/profiles/:profileId/content', protect, rateLimit({ prefix: 'user-profile-content', windowMs: 60 * 1000, max: 80 }), getProfileContent)
userRouter.get('/profiles/:profileId/connections', protect, rateLimit({ prefix: 'user-profile-connections', windowMs: 60 * 1000, max: 80 }), getProfileConnectionsPage)

export default userRouter;
