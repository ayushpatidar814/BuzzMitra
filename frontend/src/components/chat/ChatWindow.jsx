import { useSelector } from "react-redux";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";

export default function ChatWindow() {
  const activeChat = useSelector(state => state.chat.activeChat);

  if (!activeChat) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Select a chat
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b border-white/10 font-bold">
        {activeChat.name}
      </div>

      <MessageList />
      <MessageInput />
    </div>
  );
}
