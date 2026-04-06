import { kafkaProducer } from "../configs/kafka.js";

export const connectProducer = async () => {
  await kafkaProducer.connect();
  console.log("📤 Kafka Producer connected");
};

export const sendMessageToKafka = async (payload) => {
  await kafkaProducer.send({
    topic: "chat-messages",
    messages: [
      {
        key: payload.receiverId,
        value: JSON.stringify(payload),
      },
    ],
  });
};

