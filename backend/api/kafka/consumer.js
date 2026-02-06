import { kafkaConsumer } from "../configs/kafka.js";
import { saveMessage } from "../services/message.service.js";

export const startConsumer = async (io) => {
  const consumer = kafkaConsumer("chat-consumer-group");

  await consumer.connect();
  await consumer.subscribe({ topic: "chat-messages", fromBeginning: false });

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
        if(!saved) return;
        
        io.to(saved.chatId.toString()).emit("new_message", saved);
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
