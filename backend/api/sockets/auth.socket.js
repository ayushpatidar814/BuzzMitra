import User from "../models/User.js";
import { verifyAuthToken } from "../utils/auth.js";

export const socketAuthMiddleware = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(" ")[1];

    if (!token) throw new Error("No token provided");

    const payload = verifyAuthToken(token);
    const user = await User.findById(payload.sub).select("_id");
    if (!user) throw new Error("Invalid token");

    socket.user = {
      id: String(user._id),
    };

    next();
  } catch (err) {
    console.error("Socket auth failed:", err.message);
    next(new Error("Invalid token"));
  }
};
