import express from 'express';
import { upload } from '../configs/multer.js';
import { protect } from '../middlewares/auth.js';
import { addUserStory, getStories, getStoryViewers, replyToStory, viewStory } from '../controllers/storyController.js';
import { rateLimit } from '../middlewares/rateLimit.js';

const storyRouter = express.Router()

storyRouter.post('/create', upload.single('media'), protect, addUserStory)
storyRouter.get('/get', protect, rateLimit({ prefix: 'story-get', windowMs: 60 * 1000, max: 80 }), getStories);
storyRouter.post('/view', protect, rateLimit({ prefix: 'story-view', windowMs: 60 * 1000, max: 120 }), viewStory);
storyRouter.get('/viewers/:storyId', protect, rateLimit({ prefix: 'story-viewers', windowMs: 60 * 1000, max: 60 }), getStoryViewers);
storyRouter.post('/reply', protect, rateLimit({ prefix: 'story-reply', windowMs: 60 * 1000, max: 60 }), replyToStory);


export default storyRouter
