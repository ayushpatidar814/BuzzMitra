import { kafkaAdmin } from "../configs/kafka.js";

export const createTopics = async () => {
  await kafkaAdmin.connect();

  await kafkaAdmin.createTopics({
    waitForLeaders: true,
    topics: [
      {
        topic: "chat-messages",
        numPartitions: 1,
      },
    ],
  });

  await kafkaAdmin.disconnect();
  console.log("✅ Kafka topics created");
};
