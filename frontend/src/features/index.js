import { configureStore} from '@reduxjs/toolkit'
import userReducer from './user/userSlice.js'
// import messagesReducer from './messages/messagesSlice.js'
import connectionsReducer from './connections/connectionsSlice.js'
// import chatReducer from './messages/chatSlice.js'
import chatReducer from "./messagesWS/chatSlice.js";
import messageReducer from "./messagesWS/messageSlice.js";
import typingReducer from "./messagesWS/typingSlice.js";

export const store = configureStore({
    reducer: {
        user: userReducer,
        connections: connectionsReducer,
        // messages: messagesReducer,
        // chat: chatReducer
        chat: chatReducer,
        message: messageReducer,
        typing: typingReducer,
    }
})