import { kafkaAdmin } from "../configs/kafka.js";

const CHAT_TOPIC = "chat-messages";

const topicExists = async (topic) => {
  const topics = await kafkaAdmin.listTopics();
  return topics.includes(topic);
};

export const createTopics = async () => {
  const createTimeout = Number(process.env.KAFKA_CREATE_TOPIC_TIMEOUT_MS || 10000);

  await kafkaAdmin.connect();

  try {
    if (await topicExists(CHAT_TOPIC)) {
      console.log(`Kafka topic ready: ${CHAT_TOPIC}`);
      return;
    }

    try {
      await kafkaAdmin.createTopics({
        waitForLeaders: false,
        timeout: createTimeout,
        topics: [
          {
            topic: CHAT_TOPIC,
            numPartitions: 1,
            replicationFactor: 1,
          },
        ],
      });
    } catch (error) {
      const message = error?.message || "";
      if (!message.includes("TOPIC_ALREADY_EXISTS")) {
        console.warn(`Kafka topic creation warning for ${CHAT_TOPIC}: ${message}`);
      }
    }

    if (!(await topicExists(CHAT_TOPIC))) {
      throw new Error(`Kafka topic ${CHAT_TOPIC} is not available after create attempt`);
    }

    console.log(`Kafka topic ready: ${CHAT_TOPIC}`);
  } finally {
    await kafkaAdmin.disconnect();
  }
};
