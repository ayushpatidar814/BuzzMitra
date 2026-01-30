const EPOCH = 1672531200000n; // Custom epoch (1 Jan 2023)
const MACHINE_ID = BigInt(process.env.MACHINE_ID || 1);

let lastTimestamp = 0n;
let sequence = 0n;

export const generateSnowflakeId = () => {
  let timestamp = BigInt(Date.now());

  if (timestamp < EPOCH) {
    timestamp = EPOCH;
  }

  if (timestamp === lastTimestamp) {
    sequence++;
    if (sequence > 4095n) {
      // wait till next millisecond
      while (BigInt(Date.now()) <= timestamp) {}
      timestamp = BigInt(Date.now());
      sequence = 0n;
    }
  } else {
    sequence = 0n;
  }

  lastTimestamp = timestamp;

  return (
    ((timestamp - EPOCH) << 22n) |
    (MACHINE_ID << 12n) |
    sequence
  ).toString();
};
