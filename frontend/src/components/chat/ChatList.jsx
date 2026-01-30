import { useDispatch, useSelector } from "react-redux";
import { setActiveChat } from "../../store/chatSlice";

export default function ChatList() {
  const dispatch = useDispatch();
  const chats = useSelector(state => state.chat.chats);

  return (
    <div className="w-80 border-r border-white/10 overflow-y-auto">
      {chats.map(chat => (
        <div
          key={chat._id}
          onClick={() => dispatch(setActiveChat(chat))}
          className="p-4 cursor-pointer hover:bg-white/10"
        >
          <p className="font-semibold">{chat.name}</p>
          <p className="text-xs text-gray-400">
            {chat.lastMessage?.preview}
          </p>
        </div>
      ))}
    </div>
  );
}
