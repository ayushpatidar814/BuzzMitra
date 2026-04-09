import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import connectDB from './configs/db.js';

import { inngest, functions } from './inngest/index.js';
import { serve } from 'inngest/express';

import { initSocket } from './sockets/index.js';
import { connectProducer } from './kafka/producer.js';
import { startConsumer } from './kafka/consumer.js';
import { connectRedis } from './configs/redis.js';

import userRouter from './routes/userRoutes.js';
import postRouter from './routes/postRoutes.js';
import storyRouter from './routes/storyRoutes.js';
import chatRouter from './routes/chatRoutes.js';
import notificationRouter from './routes/notificationRoutes.js';
import { createTopics } from './kafka/createTopics.js';
import { flushEngagementBuffers } from './utils/engagementBuffer.js';


const app = express();
const PORT = process.env.PORT || 5000;

/* ---------------- MIDDLEWARES ---------------- */

app.use(express.json({ limit: "2mb" }));

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://buzzmitra.vercel.app",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/* ---------------- ROUTES ---------------- */

app.get('/', (req, res) => {
  res.send('Hello Ayush Patidar!');
});

app.use('/api/inngest', serve({ client: inngest, functions }));
app.use('/api/user', userRouter);
app.use('/api/post', postRouter);
app.use('/api/story', storyRouter);
app.use('/api/chat', chatRouter);
app.use('/api/notifications', notificationRouter);

app.use((req, res) => {
  return res.status(404).json({ success: false, message: "API route not found" });
});

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ success: false, message: "Invalid JSON payload" });
  }

  console.error("Unhandled API error:", error);
  return res.status(500).json({ success: false, message: "Something went wrong" });
});

/* ---------------- BOOTSTRAP ---------------- */

const startServer = async () => {
  try {
    await connectDB();
    await connectRedis();
    await createTopics();

    const server = http.createServer(app);
    const io = initSocket(server);

    await connectProducer();
    await startConsumer(io);
    setInterval(() => {
      flushEngagementBuffers().catch(() => {});
    }, 5000);

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Server failed to start:", error);
    process.exit(1);
  }
};

startServer();
