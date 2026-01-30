import { kafkaAdmin } from "../configs/kafka.js";
import { TOPICS } from "./topics.js";

export const createTopics = async () => {
  await kafkaAdmin.connect();

  await kafkaAdmin.createTopics({
    waitForLeaders: true,
    topics: [
      {
        topic: TOPICS.CHAT_MESSAGE,
        numPartitions: 3,
        replicationFactor: 1,
      },
    ],
  });

  await kafkaAdmin.disconnect();
  console.log("✅ Kafka topics created");
};
