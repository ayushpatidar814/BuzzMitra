import express from 'express';
import { upload } from '../configs/multer.js';
import { protect } from '../middlewares/auth.js';
import { addUserStory, getStories, getStoryViewers, replyToStory, viewStory } from '../controllers/storyController.js';

const storyRouter = express.Router()

storyRouter.post('/create', upload.single('media'), protect, addUserStory)
storyRouter.get('/get', protect, getStories);
storyRouter.post('/view', protect, viewStory);
storyRouter.get('/viewers/:storyId', protect, getStoryViewers);
storyRouter.post('/reply', protect, replyToStory);


export default storyRouter
