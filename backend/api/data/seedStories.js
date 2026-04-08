import mongoose from "mongoose";
import "dotenv/config";
import { faker } from "@faker-js/faker";

import Story from "../models/Story.js";
import User from "../models/User.js";
import connectDB from "../configs/db.js";

// ---------------- CONFIG ----------------
const STORIES_PER_USER = 2;
const BATCH_SIZE = 1000;

mongoose.set("autoIndex", false);

// ---------------- HELPERS ----------------
const insertInBatches = async (Model, data) => {
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    await Model.insertMany(batch, { ordered: false });
  }
};

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

const randomColor = () =>
  `#${Math.floor(Math.random() * 16777215).toString(16)}`;

// ---------------- MAIN ----------------
const seedStories = async () => {
  await connectDB();
  console.log("✅ DB Connected");

  // ---------------- USERS ----------------
  console.log("👤 Fetching users...");
  const users = await User.find({}, "_id");

  if (!users.length) {
    console.log("❌ No users found. Seed users first.");
    process.exit();
  }

  console.log("Users found:", users.length);

  // ---------------- CLEAN OLD STORIES (optional) ----------------
  await Story.deleteMany({});
  console.log("🧹 Old stories removed");

  // ---------------- CREATE STORIES ----------------
  console.log("📸 Creating stories...");

  let stories = [];

  for (const user of users) {
    for (let i = 0; i < STORIES_PER_USER; i++) {
      const isVideo = Math.random() > 0.7;

      // 👀 random viewers (simulate story views)
      const viewers = faker.helpers.arrayElements(
        users,
        faker.number.int({ min: 0, max: 20 })
      ).map((u) => u._id);

      stories.push({
        user: user._id,

        content: faker.lorem.sentence(),

        media_url: isVideo
          ? "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1.mp4"
          : faker.image.url(),

        media_type: isVideo ? "video" : "image",

        views_count: viewers, // 👀 store user IDs who viewed

        background_color: randomColor(),

        duration_ms: isVideo
          ? faker.number.int({ min: 5000, max: 15000 })
          : 8000,

        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),

        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // ---------------- INSERT ----------------
  await insertInBatches(Story, stories);

  console.log("🎉 Stories created:", stories.length);

  process.exit();
};

// ---------------- RUN ----------------
seedStories();