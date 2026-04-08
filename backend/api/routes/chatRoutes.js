import express from 'express'
import { protect } from '../middlewares/auth.js';
import { addGroupMembers, clearChatForMe, createGroupChat, demoteGroupAdmin, getChats, getMessageViewers, getMessages, getOrCreateChat, getRecentChats, leaveGroup, promoteGroupAdmin, removeGroupMember, transferGroupOwnership, updateGroupAvatar, updateGroupName, uploadMedia } from '../controllers/messageWsController.js';
import { upload } from '../configs/multer.js';

const chatRouter = express.Router();

chatRouter.use(protect);

chatRouter.post('/chat', getOrCreateChat);
chatRouter.post('/group', createGroupChat);
chatRouter.post('/group/:chatId/members', addGroupMembers);
chatRouter.post('/group/:chatId/avatar', upload.single('avatar'), updateGroupAvatar);
chatRouter.post('/group/:chatId/rename', updateGroupName);
chatRouter.post('/group/:chatId/members/:memberId/remove', removeGroupMember);
chatRouter.post('/group/:chatId/members/:memberId/promote', promoteGroupAdmin);
chatRouter.post('/group/:chatId/members/:memberId/demote', demoteGroupAdmin);
chatRouter.post('/group/:chatId/members/:memberId/transfer-owner', transferGroupOwnership);
chatRouter.post('/group/:chatId/leave', leaveGroup);
chatRouter.get('/chats', getChats);
chatRouter.delete('/:chatId/clear', clearChatForMe);

chatRouter.post('/uploadMedia', upload.single('media'), uploadMedia);
chatRouter.get('/messages/:chatId', getMessages);
chatRouter.get('/message-viewers/:messageId', getMessageViewers);

chatRouter.get('/recent-messages', getRecentChats);

export default chatRouter;
