import { kafkaConsumer } from "../configs/kafka.js";
import { TOPICS } from "./topics.js";
import { saveMessage } from "../services/message.service.js";

export const startConsumer = async (io) => {
  const consumer = kafkaConsumer("chat-consumer-group");

  await consumer.connect();
  await consumer.subscribe({ topic: TOPICS.CHAT_MESSAGE, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        let payload;

        try {
          payload = JSON.parse(message.value.toString());
        } catch (err) {
          console.warn("⚠️ Skipping invalid Kafka message");
          return;
        }

        if (!payload.senderId || !payload.receiverId) {
          console.warn("⚠️ Missing required fields, skipping");
          return;
        }
  
        const saved = await saveMessage(payload);
  
        io.to(payload.receiverId).emit("new-message", saved);
        io.to(payload.senderId).emit("message-delivered", saved._id);
      } catch (error) {
        console.error("❌ Failed to process message", error);
      }
    },
  });

  console.log("📥 Kafka Consumer running");

  process.on("SIGINT", async () => {
    await consumer.disconnect();
    process.exit(0);
  });
};
