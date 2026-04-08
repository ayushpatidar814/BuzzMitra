import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../api/axios";

const initialState = {
    followers: [],
    following: [],
    network: [],
}

export const fetchConnections = createAsyncThunk('connections/fetchConnections', async (token) => {
        const {data} = await api.get('/api/user/connections', {
            headers: {Authorization: `Bearer ${token}`},
        })
        return data.success ? data : null;
    }
)

const connectionsSlice = createSlice({
    name: 'connections',
    initialState,
    reducers: {
        resetConnections: () => initialState
    },
    extraReducers: (builder)=> {
        builder.addCase(fetchConnections.fulfilled, (state, action) => {
            if(action.payload){
                state.followers = action.payload.followers
                state.following = action.payload.following
                state.network = action.payload.network
            }
        })
    }
})

export const { resetConnections } = connectionsSlice.actions
export default connectionsSlice.reducer
