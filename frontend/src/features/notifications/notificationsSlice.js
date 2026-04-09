import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  unreadCount: 0,
};

const notificationsSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    setUnreadNotificationsCount(state, action) {
      state.unreadCount = Number(action.payload || 0);
    },
    incrementUnreadNotifications(state) {
      state.unreadCount += 1;
    },
    decrementUnreadNotifications(state) {
      state.unreadCount = Math.max(0, state.unreadCount - 1);
    },
    resetNotificationsState() {
      return initialState;
    },
  },
});

export const {
  setUnreadNotificationsCount,
  incrementUnreadNotifications,
  decrementUnreadNotifications,
  resetNotificationsState,
} = notificationsSlice.actions;

export default notificationsSlice.reducer;
