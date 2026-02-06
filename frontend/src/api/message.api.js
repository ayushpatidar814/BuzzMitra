import api from "./axios.js";

/**
 * Get messages for a given chatId (Mongo ObjectId)
 */
export const getMessages = (chatId) => api.get(`/api/chat/message/messages/${chatId}`);

/**
 * Send a message (text or media)
 * formData: { chatId, text?, media? }
 */
export const sendMessage = async (formData) =>
  api.post("/api/chat/message/message", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

/**
 * Edit a message
 */
export const editMessage = (messageId, data) =>
  api.put(`/api/chat/message/message/${messageId}`, data);

/**
 * Delete a message
 */
export const deleteMessage = (messageId) =>
  api.delete(`/api/chat/message/message/${messageId}`);

/**
 * Mark all messages in a chat as read
 */
export const markAsRead = (chatId) =>
  api.post(`/api/chat/message/chat/${chatId}/read`);

/**
 * Send typing indicator
 */
export const sendTyping = (payload) => api.post("/api/chat/message/typing", payload);
