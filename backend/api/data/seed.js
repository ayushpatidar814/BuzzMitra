import mongoose from "mongoose";
import "dotenv/config";
import { faker } from "@faker-js/faker";

import User from "../models/User.js";
import Post from "../models/Post.js";
import Story from "../models/Story.js";
import Comment from "../models/Comment.js";
import Follow from "../models/Follow.js";
import PostReaction from "../models/PostReaction.js";
import Chat from "../models/Chat.js";
import MessageWS from "../models/MessageWS.js";
import connectDB from "../configs/db.js";

// ---------------- CONFIG ----------------
const USERS_COUNT = 1000;
const POSTS_PER_USER = 3;
const STORIES_PER_USER = 2;
const BATCH_SIZE = 1000;

mongoose.set("autoIndex", false);

// ---------------- HELPERS ----------------
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

const insertInBatches = async (Model, data) => {
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    await Model.insertMany(batch, { ordered: false });
  }
};

// Unique user generator
const usedEmails = new Set();
const usedUsernames = new Set();

const generateUniqueUser = (i) => {
  let email, username;

  do {
    email = faker.internet.email().toLowerCase();
  } while (usedEmails.has(email));

  do {
    username = faker.internet.username().toLowerCase() + i;
  } while (usedUsernames.has(username));

  usedEmails.add(email);
  usedUsernames.add(username);

  return {
    email,
    full_name: faker.person.fullName(),
    username,
    bio: faker.lorem.sentence(),
    location: faker.location.city(),
    profile_picture: faker.image.avatar(),
  };
};

// ---------------- MAIN ----------------
const seed = async () => {
  await connectDB();

  console.log("🧹 Cleaning database...");
  await Promise.all([
    User.deleteMany({}),
    Post.deleteMany({}),
    Story.deleteMany({}),
    Comment.deleteMany({}),
    Follow.deleteMany({}),
    PostReaction.deleteMany({}),
    Chat.deleteMany({}),
    MessageWS.deleteMany({})
  ]);

  // ---------------- USERS ----------------
  console.log("👤 Creating users...");
  const users = [];

  for (let i = 0; i < USERS_COUNT; i++) {
    users.push(generateUniqueUser(i));
  }

  const createdUsers = await User.insertMany(users);
  console.log("Users:", createdUsers.length);

  // ---------------- POSTS ----------------
  console.log("📝 Creating posts...");
  const categories = ["tech", "fun", "travel", "food", "fitness"];
  const audiences = ["students", "developers", "creators"];

  let posts = [];

  for (const user of createdUsers) {
    for (let i = 0; i < POSTS_PER_USER; i++) {
      posts.push({
        user: user._id,
        content: faker.lorem.paragraph(),
        caption: faker.lorem.sentence(),
        media_type: "image",
        post_type: "image",
        image_urls: [faker.image.url()],
        category: randomItem(categories),
        sub_category: "general",
        target_audience: randomItem(audiences),
      });
    }
  }

  const createdPosts = await Post.insertMany(posts);
  console.log("Posts:", createdPosts.length);

  // ---------------- STORIES ----------------
  console.log("📸 Creating stories...");
  let stories = [];

  for (const user of createdUsers) {
    for (let i = 0; i < STORIES_PER_USER; i++) {
      stories.push({
        user: user._id,
        content: faker.lorem.sentence(),
        media_url: faker.image.url(),
        media_type: "image",
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    }
  }

  await insertInBatches(Story, stories);
  console.log("Stories:", stories.length);

  // ---------------- FOLLOWS ----------------
  console.log("🤝 Creating followers...");
  let follows = [];
  const followSet = new Set();

  for (const user of createdUsers) {
    const count = faker.number.int({ min: 5, max: 30 });

    for (let i = 0; i < count; i++) {
      const target = randomItem(createdUsers);

      if (user._id.equals(target._id)) continue;

      const key = `${user._id}-${target._id}`;
      if (followSet.has(key)) continue;

      followSet.add(key);

      follows.push({
        followerId: user._id,
        followingId: target._id,
      });
    }
  }

  await insertInBatches(Follow, follows);
  console.log("Follows:", follows.length);

  // Update follower counts
  const userMap = {};

  follows.forEach(f => {
    userMap[f.followerId] = userMap[f.followerId] || { following: 0, followers: 0 };
    userMap[f.followingId] = userMap[f.followingId] || { following: 0, followers: 0 };

    userMap[f.followerId].following++;
    userMap[f.followingId].followers++;
  });

  await User.bulkWrite(
    Object.entries(userMap).map(([id, val]) => ({
      updateOne: {
        filter: { _id: id },
        update: {
          $inc: {
            followers_count: val.followers,
            following_count: val.following
          }
        }
      }
    }))
  );

  // ---------------- REACTIONS ----------------
  console.log("❤️ Creating reactions...");
  let reactions = [];
  const reactionSet = new Set();

  for (const post of createdPosts) {
    const count = faker.number.int({ min: 5, max: 50 });

    for (let i = 0; i < count; i++) {
      const user = randomItem(createdUsers);
      const type = randomItem(["like", "save"]);

      const key = `${post._id}-${user._id}-${type}`;
      if (reactionSet.has(key)) continue;

      reactionSet.add(key);

      reactions.push({
        postId: post._id,
        userId: user._id,
        type,
      });
    }
  }

  await insertInBatches(PostReaction, reactions);
  console.log("Reactions:", reactions.length);

  // Update like counts
  const likeMap = {};

  reactions.forEach(r => {
    if (r.type === "like") {
      likeMap[r.postId] = (likeMap[r.postId] || 0) + 1;
    }
  });

  await Post.bulkWrite(
    Object.entries(likeMap).map(([postId, count]) => ({
      updateOne: {
        filter: { _id: postId },
        update: { $set: { likes_count: count } }
      }
    }))
  );

  // ---------------- COMMENTS ----------------
  console.log("💬 Creating comments...");
  let comments = [];

  for (const post of createdPosts) {
    const count = faker.number.int({ min: 2, max: 15 });

    for (let i = 0; i < count; i++) {
      comments.push({
        post: post._id,
        user: randomItem(createdUsers)._id,
        text: faker.lorem.sentence(),
      });
    }
  }

  await insertInBatches(Comment, comments);
  console.log("Comments:", comments.length);

  // ---------------- CHATS ----------------
  console.log("💬 Creating chats...");
  let chats = [];

  for (let i = 0; i < 300; i++) {
    const u1 = randomItem(createdUsers);
    const u2 = randomItem(createdUsers);

    if (!u1._id.equals(u2._id)) {
      chats.push({ participants: [u1._id, u2._id] });
    }
  }

  const createdChats = await Chat.insertMany(chats);
  console.log("Chats:", createdChats.length);

  // ---------------- MESSAGES ----------------
  console.log("📩 Creating messages...");
  let messages = [];

  for (const chat of createdChats) {
    const count = faker.number.int({ min: 5, max: 20 });

    for (let i = 0; i < count; i++) {
      const sender = randomItem(chat.participants);
      const receiver = chat.participants.find(p => !p.equals(sender));

      messages.push({
        chatId: chat._id,
        senderId: sender,
        receiverId: receiver,
        type: "text",
        text: faker.lorem.sentence(),
        messageId: faker.string.uuid(),
      });
    }
  }

  await insertInBatches(MessageWS, messages);
  console.log("Messages:", messages.length);

  console.log("🎉 SEEDING COMPLETED SUCCESSFULLY!");
  process.exit();
};

seed();