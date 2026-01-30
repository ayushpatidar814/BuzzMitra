import { useSelector } from "react-redux";
import MessageItem from "./MessageItem";

export default function MessageList() {
  const messages = useSelector(state => state.chat.messages);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map(msg => (
        <MessageItem key={msg.messageId} message={msg} />
      ))}
    </div>
  );
}
