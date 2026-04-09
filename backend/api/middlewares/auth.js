import User from "../models/User.js";
import { verifyAuthToken } from "../utils/auth.js";

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const payload = verifyAuthToken(token);
    const user = await User.findById(payload.sub).select("_id");

    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: error.message });
  }
};
