export const selectTotalUnread = (state) => Object.keys(state.chatCount.perChat).length;

export const selectChatUnread = (chatId) => (state) =>
  state.chatCount.perChat[chatId] || 0;
