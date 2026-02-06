// src/api/chat.api.js
import api from "./axios.js";

/**
 * Get all chats of logged-in user
 */
export const getChats = () => api.get("/api/chat/chats");

/**
 * Get or create a chat with a specific user (by their Clerk userId)
 */
export const getOrCreateChat = (receiverId) =>
  api.post("/api/chat/chat", { receiverId });
