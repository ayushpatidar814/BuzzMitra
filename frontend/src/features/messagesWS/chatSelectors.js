export const selectTotalUnread = (state) =>
  state.chatCount.totalUnreadChats || 0;

export const selectChatUnread = (chatId) => (state) =>
  state.chatCount.perChat[chatId] || 0;
