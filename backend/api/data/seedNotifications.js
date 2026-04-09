import mongoose from "mongoose";
import "dotenv/config";
import { faker } from "@faker-js/faker";

import Notification from "../models/Notification.js";
import User from "../models/User.js";
import connectDB from "../configs/db.js";

// ---------------- CONFIG ----------------
const NOTIFICATIONS_PER_USER = 20;
const BATCH_SIZE = 1000;

mongoose.set("autoIndex", false);

// ---------------- HELPERS ----------------
const insertInBatches = async (Model, data) => {
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    await Model.insertMany(batch, { ordered: false });
  }
};

// Notification types (same as your schema)
const NOTIFICATION_TYPES = [
  "follow",
  "like_post",
  "comment_post",
  "reply_comment",
  "share_post",
  "message",
  "story_reply",
  "group_added",
  "group_promoted",
  "group_owner_transferred",
];

// Random entity type
const ENTITY_TYPES = ["post", "comment", "story", "chat", "group", "profile"];

// Generate realistic notification text
const generateNotificationContent = (type) => {
  switch (type) {
    case "follow":
      return {
        title: "New follower",
        text: faker.person.fullName() + " started following you",
      };
    case "like_post":
      return {
        title: "Post liked",
        text: "liked your post",
      };
    case "comment_post":
      return {
        title: "New comment",
        text: faker.lorem.words(5),
      };
    case "message":
      return {
        title: "New message",
        text: faker.lorem.sentence(),
      };
    default:
      return {
        title: faker.lorem.words(2),
        text: faker.lorem.sentence(),
      };
  }
};

// ---------------- MAIN ----------------
const seedNotifications = async () => {
  await connectDB();
  console.log("✅ DB Connected");

  const users = await User.find({}, "_id");

  if (!users.length) {
    console.log("❌ No users found.");
    process.exit();
  }

  console.log("Users:", users.length);

  let notifications = [];

  for (const recipient of users) {
    for (let i = 0; i < NOTIFICATIONS_PER_USER; i++) {
      const type = faker.helpers.arrayElement(NOTIFICATION_TYPES);

      // 👤 random actor (not same as recipient)
      const actor = faker.helpers.arrayElement(
        users.filter((u) => !u._id.equals(recipient._id))
      );

      const entityType = faker.helpers.arrayElement(ENTITY_TYPES);

      const content = generateNotificationContent(type);

      const createdAt = faker.date.recent({ days: 7 });

      const isRead = Math.random() > 0.5;

      notifications.push({
        recipient: recipient._id,
        actor: actor?._id || null,
        type,

        title: content.title,
        text: content.text,

        link: "",

        entityType,
        entityId: new mongoose.Types.ObjectId().toString(),

        meta: {
          preview: faker.lorem.words(3),
        },

        readAt: isRead ? faker.date.between({ from: createdAt, to: new Date() }) : null,

        createdAt,
        updatedAt: createdAt,
      });
    }
  }

  await insertInBatches(Notification, notifications);

  console.log("🎉 Notifications created:", notifications.length);
  process.exit();
};

seedNotifications();