import express from 'express'
import {
  discoverUsers,
  followUser,
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

const userRouter = express.Router();

userRouter.post('/register', registerUser)
userRouter.post('/login', loginUser)
userRouter.get('/oauth/:provider', oauthStart)
userRouter.get('/oauth/:provider/callback', oauthCallback)
userRouter.get('/data', protect, getUserData)
userRouter.post('/update', upload.fields([{name: 'profile', maxCount:1}, {name: 'cover', maxCount: 1}]), protect, updatedUserData)
userRouter.post('/discover', protect, discoverUsers)
userRouter.post('/follow', protect, followUser)
userRouter.post('/unfollow', protect, unfollowUser)
userRouter.get('/connections', protect, getUserConnections)
userRouter.post('/profiles', protect, getUserProfiles)

export default userRouter;
