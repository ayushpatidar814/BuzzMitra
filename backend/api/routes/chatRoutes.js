import express from 'express'
import { protect } from '../middlewares/auth.js';
import { deleteMessage, editMessage, getChats, getMessages, getOrCreateChat, markAsRead, sendTyping, uploadMedia } from '../controllers/messageWsController.js';
import { upload } from '../configs/multer.js';

const chatRouter = express.Router();

chatRouter.use(protect);

chatRouter.post('/chat', getOrCreateChat);
chatRouter.get('/chats', getChats);

chatRouter.post('/uploadMedia', upload.single('media'), uploadMedia);
chatRouter.get('/messages/:chatId', getMessages);

chatRouter.put('/message/:messageId', editMessage);
chatRouter.delete('/message/:messageId', deleteMessage);

chatRouter.post('/chat/:chatId/read', markAsRead);
chatRouter.post('/typing', sendTyping);

export default chatRouter;
