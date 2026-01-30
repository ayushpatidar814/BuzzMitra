import { kafkaProducer } from "../configs/kafka.js";
import { TOPICS } from "./topics.js";

export const connectProducer = async () => {
  await kafkaProducer.connect();
  console.log("📤 Kafka Producer connected");
};

export const sendMessageToKafka = async (payload) => {
  await kafkaProducer.send({
    topic: TOPICS.CHAT_MESSAGE,
    messages: [
      {
        key: payload.receiverId,
        value: JSON.stringify(payload),
      },
    ],
  });
};
