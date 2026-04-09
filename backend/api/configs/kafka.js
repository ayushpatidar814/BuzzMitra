import 'dotenv/config';
import { Kafka, logLevel } from "kafkajs";

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || "buzzmitra-backend",
  brokers: process.env.KAFKA_BROKERS.split(","),
  ssl: {
    rejectUnauthorized: true,
    ca: [process.env.KAFKA_CA_CERT.replace(/\\n/g, '\n')],
    cert: process.env.KAFKA_SERV_CERT.replace(/\\n/g, '\n'),
    key: process.env.KAFKA_KEY_CERT.replace(/\\n/g, '\n'),
  },

  retry: {
    initialRetryTime: 300,
    retries: 10
  },

  logLevel: logLevel.ERROR,
});

/**
 * Shared instances
 */
export const kafkaProducer = kafka.producer({
  allowAutoTopicCreation: false,
  idempotent: true, // 🔐 ensures exactly-once delivery
  maxInFlightRequests: 5,
  retry: {
    retries: 5,
    initialRetryTime: 300,
  },
});

export const kafkaConsumer = (groupId) =>
  kafka.consumer({
    groupId,
    allowAutoTopicCreation: false,
  });

export const kafkaAdmin = kafka.admin();

export default kafka;