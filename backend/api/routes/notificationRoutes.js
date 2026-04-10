import express from "express";
import { protect } from "../middlewares/auth.js";
import { rateLimit } from "../middlewares/rateLimit.js";
import {
  getNotifications,
  getUnreadNotificationsCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notificationController.js";

const notificationRouter = express.Router();

notificationRouter.use(protect);

notificationRouter.get("/", rateLimit({ prefix: "notifications-list", windowMs: 60 * 1000, max: 180 }), getNotifications);
notificationRouter.get("/unread-count", rateLimit({ prefix: "notifications-count", windowMs: 60 * 1000, max: 220 }), getUnreadNotificationsCount);
notificationRouter.post("/mark-all-read", rateLimit({ prefix: "notifications-mark-all", windowMs: 60 * 1000, max: 300 }), markAllNotificationsRead);
notificationRouter.post("/:notificationId/read", rateLimit({ prefix: "notifications-read", windowMs: 60 * 1000, max: 300 }), markNotificationRead);

export default notificationRouter;
