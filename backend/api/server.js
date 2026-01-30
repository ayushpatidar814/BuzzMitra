import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
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
import { createTopics } from './kafka/createTopics.js';

const app = express();
const PORT = process.env.PORT || 5000;

/* ---------------- MIDDLEWARES ---------------- */

app.use(express.json());

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://your-vercel-app.vercel.app"
    ],
    credentials: true
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
