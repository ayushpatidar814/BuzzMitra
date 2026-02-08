import { createSlice } from "@reduxjs/toolkit";

/* ---------- INITIAL STATE ---------- */
const initialState = {
  totalUnread: 0,
  perChat: {}, // { chatId: number }
};

/* ---------- SLICE ---------- */
const chatCountSlice = createSlice({
  name: "chatCount",
  initialState,
  reducers: {
    /* 🔔 Incoming message */
    incrementUnread(state, action) {
      const chatId = action.payload;
      if (!chatId) return;

      state.perChat[chatId] = (state.perChat[chatId] || 0) + 1;
      state.totalUnread += 1;
    },

    /* 📖 Chat opened → mark as read */
    resetChatUnread(state, action) {
      const chatId = action.payload;
      if (!chatId) return;

      const count = state.perChat[chatId] || 0;

      state.totalUnread = Math.max(0, state.totalUnread - count);
      delete state.perChat[chatId];
    },

    /* 🔄 Initial load from backend */
    setInitialCounts(state, action) {
      const perChat = action.payload?.perChat || {};

      state.perChat = perChat;
      state.totalUnread = Object.values(perChat).reduce(
        (sum, count) => sum + count,
        0
      );
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
  resetAllUnread,
} = chatCountSlice.actions;

/* ---------- SELECTORS ---------- */
export const selectTotalUnread = (state) =>
  state.chatCount.totalUnread;

export const selectChatUnread = (chatId) => (state) =>
  state.chatCount.perChat[chatId] || 0;

export default chatCountSlice.reducer;
