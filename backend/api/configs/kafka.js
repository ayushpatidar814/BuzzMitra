import 'dotenv/config';
import fs from 'fs';
import { Kafka, logLevel } from "kafkajs";

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || "buzzmitra-backend",
  brokers: process.env.KAFKA_BROKERS.split(","),
  ssl: {
    rejectUnauthorized: true,
    ca: [fs.readFileSync('./api/ca.pem', 'utf-8')],
    cert: fs.readFileSync('./api/service.cert', 'utf-8'),
    key: fs.readFileSync('./api/service.key', 'utf-8'),
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
