import express from 'express'
import { protect } from '../middlewares/auth.js';
import { addGroupMembers, clearChatForMe, createGroupChat, demoteGroupAdmin, getChats, getMessageViewers, getMessages, getOrCreateChat, getRecentChats, leaveGroup, promoteGroupAdmin, removeGroupMember, transferGroupOwnership, updateGroupAvatar, updateGroupName, uploadMedia } from '../controllers/messageWsController.js';
import { upload } from '../configs/multer.js';
import { rateLimit } from '../middlewares/rateLimit.js';

const chatRouter = express.Router();

chatRouter.use(protect);

chatRouter.post('/chat', rateLimit({ prefix: 'chat-open', windowMs: 60 * 1000, max: 120 }), getOrCreateChat);
chatRouter.post('/group', rateLimit({ prefix: 'chat-group-create', windowMs: 60 * 1000, max: 30 }), createGroupChat);
chatRouter.post('/group/:chatId/members', rateLimit({ prefix: 'chat-group-members', windowMs: 60 * 1000, max: 80 }), addGroupMembers);
chatRouter.post('/group/:chatId/avatar', upload.single('avatar'), updateGroupAvatar);
chatRouter.post('/group/:chatId/rename', updateGroupName);
chatRouter.post('/group/:chatId/members/:memberId/remove', removeGroupMember);
chatRouter.post('/group/:chatId/members/:memberId/promote', promoteGroupAdmin);
chatRouter.post('/group/:chatId/members/:memberId/demote', demoteGroupAdmin);
chatRouter.post('/group/:chatId/members/:memberId/transfer-owner', transferGroupOwnership);
chatRouter.post('/group/:chatId/leave', leaveGroup);
chatRouter.get('/chats', rateLimit({ prefix: 'chat-list', windowMs: 60 * 1000, max: 150 }), getChats);
chatRouter.delete('/:chatId/clear', clearChatForMe);

chatRouter.post('/uploadMedia', rateLimit({ prefix: 'chat-upload', windowMs: 60 * 1000, max: 40 }), upload.single('media'), uploadMedia);
chatRouter.get('/messages/:chatId', rateLimit({ prefix: 'chat-messages', windowMs: 60 * 1000, max: 150 }), getMessages);
chatRouter.get('/message-viewers/:messageId', getMessageViewers);

chatRouter.get('/recent-messages', rateLimit({ prefix: 'chat-recent', windowMs: 60 * 1000, max: 1200 }), getRecentChats);

export default chatRouter;
