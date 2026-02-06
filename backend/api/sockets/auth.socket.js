import { verifyToken } from "@clerk/backend";

export const socketAuthMiddleware = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(" ")[1];

    if (!token) throw new Error("No token provided");

    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    socket.user = {
      id: payload.sub, // Clerk userId
    };

    next();
  } catch (err) {
    console.error("🔐 Socket auth failed:", err.message);
    next(new Error("Invalid token"));
  }
};
