import { createSlice } from "@reduxjs/toolkit";

const typingSlice = createSlice({
  name: "typing",
  initialState: {
    usersByChat: {},
  },
  reducers: {
    setTyping(state, action) {
      const { chatId, userId, isTyping } = action.payload;
      state.usersByChat[chatId] = isTyping ? userId : null;
    },
    clearTyping(state, action) {
      delete state.usersByChat[action.payload];
    },
  },
});

export const { setTyping, clearTyping } = typingSlice.actions;
export default typingSlice.reducer;
