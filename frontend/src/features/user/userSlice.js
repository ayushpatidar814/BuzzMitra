import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../api/axios.js";
import toast from "react-hot-toast";

const initialState = {
    value: JSON.parse(localStorage.getItem("user")) || null
}

export const fetchUser = createAsyncThunk('user/fetchUser', async(token) => {
    const { data } = await api.get('/api/user/data', {
        headers: {Authorization: `Bearer ${token}`}
    })
  
    if (data.success) {
    return data.user;
  }

  return null;
})

export const updateUser = createAsyncThunk('user/update', async({userData, token}) => {
    const { data } = await api.post('/api/user/update', userData, {
        headers: {Authorization: `Bearer ${token}`}
    })
    if(data.success){
        toast.success(data.message)
        return data.user
    } else{
        toast.error(data.message)
    }
})

const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        setUser: (state, action) => {
            state.value = action.payload
            localStorage.setItem("user", JSON.stringify(action.payload))
        },
        clearUser: (state) => {
            state.value = null
            localStorage.removeItem("user")
        }
    },
    extraReducers: (builder) => {
        builder.addCase(fetchUser.fulfilled, (state, action) => {
            state.value = action.payload
            if(action.payload){
                localStorage.setItem("user", JSON.stringify(action.payload))
            }
        }).addCase(updateUser.fulfilled, (state, action) => {
            state.value = action.payload
            if(action.payload){
                localStorage.setItem("user", JSON.stringify(action.payload))
            }
        })
    }
})

export const { setUser, clearUser } = userSlice.actions
export default userSlice.reducer
