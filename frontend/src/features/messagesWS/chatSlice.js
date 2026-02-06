import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getChats } from "../../api/chat.api";

const initialState = {
  list: [],               // all chats
  activeChatId: null,     // currently opened chat
  loading: false,
};

export const fetchChats = createAsyncThunk(
  "chat/fetchChats",
  async () => {
    const { data } = await getChats();
    return data.data;
  }
);

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setChats(state, action) {
      state.list = action.payload;
    },

    addChat(state, action) {
      const exists = state.list.find(
        c => c._id === action.payload._id
      );
      if (!exists) {
        state.list.unshift(action.payload);
      }
    },

    setActiveChat(state, action) {
      state.activeChatId = action.payload;
    },

    updateLastMessage(state, action) {
      const { chatId, message } = action.payload;

      const chat = state.list.find(c => c._id === chatId);
      if (!chat) return;

      chat.lastMessage = message;
      chat.updatedAt = new Date().toISOString();

      // move chat to top
      state.list = [
        chat,
        ...state.list.filter(c => c._id !== chatId),
      ];
    },

    incrementUnread(state, action) {
      const chat = state.list.find(c => c._id === action.payload);
      if (!chat) return;

      chat.unreadCount = (chat.unreadCount || 0) + 1;
    },

    resetUnread(state, action) {
      const chat = state.list.find(c => c._id === action.payload);
      if (chat) chat.unreadCount = 0;
    },
  },
  extraReducers: (builder) => {
      builder.addCase(fetchChats.fulfilled, (state, action) => {
        state.list = action.payload;
      });
  },
});

export const {
  setChats,
  addChat,
  setActiveChat,
  updateLastMessage,
  incrementUnread,
  resetUnread,
} = chatSlice.actions;

export default chatSlice.reducer;
