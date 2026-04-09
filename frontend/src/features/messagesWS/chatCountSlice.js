import { createSlice } from "@reduxjs/toolkit";

/* ---------- INITIAL STATE ---------- */
const initialState = {
  totalUnreadChats: 0,
  perChat: {}, // { chatId: number }
};

/* ---------- SLICE ---------- */
const chatCountSlice = createSlice({
  name: "chatCount",
  initialState,
  reducers: {

    /* 🔄 Hydrate from backend */
    setInitialCounts(state, action) {
      const chats = action.payload || [];

      const perChat = {};
      let total = 0;

      chats.forEach(chat => {
        if (chat.unreadMessages > 0) {
          perChat[chat._id] = chat.unreadMessages;
          total += 1;
        }
      });

      state.perChat = perChat;
      state.totalUnreadChats = total;
    },

    setUnreadChatsCount(state, action) {
      state.totalUnreadChats = Number(action.payload || 0);
    },

    /* 🔔 Incoming message */
    incrementUnread(state, action) {
      const chatId = action.payload;
      if (!chatId) return;

      const wasUnread = Boolean(state.perChat[chatId]);
      state.perChat[chatId] = (state.perChat[chatId] || 0) + 1;
      if (!wasUnread) {
        state.totalUnreadChats += 1;
      }
    },

    /* 📖 Chat opened → mark as read */
    resetChatUnread(state, action) {
      const chatId = action.payload;
      if (!chatId) return;

      const count = state.perChat[chatId] || 0;

      if (count > 0) {
        state.totalUnreadChats = Math.max(0, state.totalUnreadChats - 1);
      }
      delete state.perChat[chatId];
    },

    /* 🚪 Logout / hard reset */
    resetAllUnread() {
      return initialState;
    },
  },
});

/* ---------- ACTIONS ---------- */
export const {
  incrementUnread,
  resetChatUnread,
  setInitialCounts,
  setUnreadChatsCount,
  resetAllUnread,
} = chatCountSlice.actions;

/* ---------- SELECTORS ---------- */
export const selectTotalUnread = (state) =>
  state.chatCount.totalUnreadChats;

export const selectChatUnread = (chatId) => (state) =>
  state.chatCount.perChat[chatId] || 0;

export default chatCountSlice.reducer;
