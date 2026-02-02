import express from 'express'
import { protect } from '../middlewares/auth.js';
import { deleteMessage, editMessage, getChats, getMessages, getOrCreateChat, markAsRead, sendMessage, sendTyping } from '../controllers/messageWsController.js';
import { upload } from '../configs/multer.js';

const chatRouter = express.Router();

chatRouter.use(protect);

chatRouter.post('/chat', getOrCreateChat);
chatRouter.get('/chats', getChats);

chatRouter.post('/message', upload.single('media'), sendMessage);
chatRouter.get('/messages/:chatId', getMessages);

chatRouter.put('/message/:messageId', editMessage);
chatRouter.delete('/message/:messageId', deleteMessage);

chatRouter.post('/chat/:chatId/read', markAsRead);
chatRouter.post('/typing', sendTyping);

export default chatRouter;
