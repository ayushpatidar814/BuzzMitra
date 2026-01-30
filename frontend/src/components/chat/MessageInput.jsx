import { useState } from "react";
import { socket } from "../../socket/socket";
import { useSelector } from "react-redux";
import { v4 as uuid } from "uuid";

export default function MessageInput() {
  const [text, setText] = useState("");
  const activeChat = useSelector(state => state.chat.activeChat);

  const sendMessage = () => {
    if (!text.trim()) return;

    socket.emit("message:send", {
      chatId: activeChat._id,
      type: "text",
      text,
      messageId: uuid(),
    });

    setText("");
  };

  return (
    <div className="p-4 border-t border-white/10 flex gap-2">
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        className="flex-1 bg-white/10 rounded-xl px-4"
        placeholder="Type a message..."
      />
      <button
        onClick={sendMessage}
        className="bg-red-600 px-4 rounded-xl"
      >
        Send
      </button>
    </div>
  );
}
