import dotenv from 'dotenv';
import http from 'http';
import express from 'express';
import cors from 'cors';
import path from "path";
import connectDB from './configs/db.js';

import { inngest, functions } from './inngest/index.js';
import { serve } from 'inngest/express';
import { clerkMiddleware } from '@clerk/express';

import { initSocket } from './sockets/index.js';
import { connectProducer } from './kafka/producer.js';
import { startConsumer } from './kafka/consumer.js';

import userRouter from './routes/userRoutes.js';
import postRouter from './routes/postRoutes.js';
import storyRouter from './routes/storyRoutes.js';
import messageRouter from './routes/messageRoutes.js';
import chatRouter from './routes/chatRoutes.js';
import { createTopics } from './kafka/createTopics.js';

dotenv.config({ path: path.resolve('./api/.env') });

const app = express();
const PORT = process.env.PORT || 5000;

/* ---------------- MIDDLEWARES ---------------- */

app.use(express.json());

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

app.use(clerkMiddleware());

/* ---------------- ROUTES ---------------- */

app.get('/', (req, res) => {
  res.send('Hello Ayush Patidar!');
});

app.use('/api/inngest', serve({ client: inngest, functions }));
app.use('/api/user', userRouter);
app.use('/api/post', postRouter);
app.use('/api/story', storyRouter);
app.use('/api/message', messageRouter);
app.use('/api/chat', chatRouter);

/* ---------------- BOOTSTRAP ---------------- */

const startServer = async () => {
  try {
    await connectDB();
    await createTopics();

    const server = http.createServer(app);

    const io = initSocket(server);

    await connectProducer();
    await startConsumer(io);

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Server failed to start:", error);
    process.exit(1);
  }
};

startServer();
