import express from 'express'
import { protect } from '../middlewares/auth.js';
import { clearChatForMe, getChats, getMessages, getOrCreateChat, uploadMedia } from '../controllers/messageWsController.js';
import { upload } from '../configs/multer.js';

const chatRouter = express.Router();

chatRouter.use(protect);

chatRouter.post('/chat', getOrCreateChat);
chatRouter.get('/chats', getChats);
chatRouter.delete('/:chatId/clear', clearChatForMe);

chatRouter.post('/uploadMedia', upload.single('media'), uploadMedia);
chatRouter.get('/messages/:chatId', getMessages);

export default chatRouter;
