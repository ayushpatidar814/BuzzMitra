export const SOCKET_EVENTS = {
  // Presence
  USER_ONLINE: "user:online",
  USER_OFFLINE: "user:offline",
  PRESENCE_GET: "presence:get",
  PRESENCE_LIST: "presence:list",

  // Chat
  MESSAGE_SEND: "message:send",
  MESSAGE_RECEIVE: "message:receive",
  MESSAGE_READ: "message:read",
  MESSAGE_TYPING: "message:typing",

  // Errors
  SOCKET_ERROR: "socket:error",
};

export const KAFKA_TOPICS = {
  CHAT_MESSAGES: "chat.messages",
  MEDIA_MESSAGES: "media.messages",
  PRESENCE_EVENTS: "presence.events",
};

export const MESSAGE_TYPES = {
  TEXT: "text",
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
};

export const MESSAGE_STATUS = {
  PENDING: "pending",
  SENT: "sent",
  FAILED: "failed",
};

export const MESSAGE_READ_STATUS = {
  SENT: "sent",
  DELIVERED: "delivered",
  READ: "read",
};

export const USER_ROLES = {
  USER: "user",
  ADMIN: "admin",
};
