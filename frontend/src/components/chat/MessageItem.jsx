import clsx from "clsx";

export default function MessageItem({ message }) {
  const isMe = message.isSender; // backend should send this flag

  return (
    <div
      className={clsx(
        "max-w-[70%] px-4 py-2 rounded-2xl text-sm break-words",
        isMe
          ? "ml-auto bg-red-600 text-white rounded-br-md"
          : "mr-auto bg-white/10 text-white rounded-bl-md"
      )}
    >
      {/* TEXT MESSAGE */}
      {message.type === "text" && (
        <p>{message.text}</p>
      )}

      {/* IMAGE MESSAGE */}
      {message.type === "image" && (
        <img
          src={message.url}
          alt="sent media"
          className="rounded-xl max-h-64 object-cover"
          loading="lazy"
        />
      )}

      {/* VIDEO MESSAGE */}
      {message.type === "video" && (
        <video
          src={message.url}
          controls
          className="rounded-xl max-h-64"
        />
      )}

      {/* TIME */}
      <p className="text-[10px] text-gray-300 mt-1 text-right">
        {new Date(message.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </div>
  );
}
