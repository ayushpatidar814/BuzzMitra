import ChatList from "./ChatList";
import ChatWindow from "./ChatWindow";

export default function ChatLayout() {
  return (
    <div className="h-[calc(100vh-64px)] flex bg-neutral-900 text-white rounded-2xl overflow-hidden border border-white/10">
      
      {/* LEFT: Chat List */}
      <ChatList />

      {/* RIGHT: Chat Window */}
      <ChatWindow />

    </div>
  );
}
