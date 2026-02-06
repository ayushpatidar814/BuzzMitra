// src/features/messagesWS/messageSlice.js
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getMessages as apiGetMessages } from "../../api/message.api.js";

/**
 * Fetch messages for a chat
 */
export const fetchMessages = createAsyncThunk(
  "messages/fetchMessages",
  async ({ chatId }) => {
    const { data } = await apiGetMessages(chatId);
    return { chatId, messages: data.data };
  }
);

const messageSlice = createSlice({
  name: "message",
  initialState: {
    byChat: {},
    loading: false,
    error: null,
  },
  reducers: {
    addMessage(state, action) {
      const { chatId, message } = action.payload;
      if (!state.byChat[chatId]) state.byChat[chatId] = [];
      state.byChat[chatId].push(message);
    },
    clearMessages(state) {
      state.byChat = {};
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchMessages.fulfilled, (state, action) => {
      const { chatId, messages } = action.payload;
      state.byChat[chatId] = messages;
    });
  },
});

export const { addMessage, clearMessages } = messageSlice.actions;
export default messageSlice.reducer;
