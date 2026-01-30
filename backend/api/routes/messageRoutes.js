import express from 'express';
import { upload } from '../configs/multer.js';
import { protect } from '../middlewares/auth.js';
import { getChats, getMessages, sendMessage } from '../controllers/messageWsController.js';
// import { getChatMessages, sendMessage, sseController } from '../controllers/messageController.js';

const messageRouter = express.Router()

//Normal
// messageRouter.get('/:userId', sseController);
// messageRouter.post('/send', upload.single('image'), protect, sendMessage)
// messageRouter.post('/get', protect, getChatMessages)

//WS
messageRouter.post('/send', upload.single('image'), sendMessage)
messageRouter.get('/chat', protect, getChats)
messageRouter.get('/:chatId', protect, getMessages)

export default messageRouter