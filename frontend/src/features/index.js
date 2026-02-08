import { configureStore} from '@reduxjs/toolkit'
import userReducer from './user/userSlice.js'
// import messagesReducer from './messages/messagesSlice.js'
import connectionsReducer from './connections/connectionsSlice.js'
import chatCountReducer from "./messagesWS/chatCountSlice.js";
// import chatReducer from './messages/chatSlice.js'
// import messageReducer from "./messagesWS/messageSlice.js";

export const store = configureStore({
    reducer: {
        user: userReducer,
        connections: connectionsReducer,
        // messages: messagesReducer,
        // chat: chatReducer
        chatCount: chatCountReducer
    }
})