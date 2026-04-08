import { Inngest } from "inngest";
import User from "../models/User.js";
import Connection from "../models/Connection.js";
import sendEmail from "../configs/nodeMailer.js";
import MessageWS from "../models/MessageWS.js";

export const inngest = new Inngest({ id: "buzzmitra-app" });

const sendNewConnectionRequestReminder = inngest.createFunction(
  { id: "send-new-connection-request-reminder" },
  { event: "app/connection-request" },
  async ({ event, step }) => {
    const { connectionId } = event.data;

    const sendReminder = async () => {
      const connection = await Connection.findById(connectionId).populate("from_user_id to_user_id");
      if (!connection || connection.status === "accepted") {
        return { message: "Already accepted or no longer exists" };
      }

      const subject = "New Connection Request";
      const body = `<div style='font-family: Arial, sans-serif; padding: 20px;'>
        <h2>Hi ${connection.to_user_id.full_name},</h2>
        <p>You have a new connection request from ${connection.from_user_id.full_name} - @${connection.from_user_id.username}</p>
        <p>Open <a href="${process.env.FRONTEND_URL}/connections" style='color:#10b981;'>BuzzMitra</a> to review it.</p>
        <br />
        <p>Thanks,<br />BuzzMitra</p>
      </div>`;

      await sendEmail({ to: connection.to_user_id.email, subject, body });
      return { message: "Reminder sent" };
    };

    await step.run("send-initial-connection-request-mail", sendReminder);
    await step.sleepUntil("wait-for-24-hours", new Date(Date.now() + 24 * 60 * 60 * 1000));
    return step.run("send-follow-up-connection-request-mail", sendReminder);
  }
);

const sendNotificationOfUnseenMessages = inngest.createFunction(
  { id: "send-unseen-messages-notification" },
  { cron: "TZ=Asia/Kolkata 0 9 * * *" },
  async () => {
    const messages = await MessageWS.find({ status: "sent" }).lean();
    const unseenCount = messages.reduce((acc, message) => {
      const key = String(message.receiverId);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    for (const userId of Object.keys(unseenCount)) {
      const user = await User.findById(userId);
      if (!user) continue;

      await sendEmail({
        to: user.email,
        subject: `You have ${unseenCount[userId]} unseen messages`,
        body: `<div style='font-family: Arial, sans-serif; padding: 20px;'>
          <h2>Hello ${user.full_name},</h2>
          <p>You have ${unseenCount[userId]} unseen messages waiting.</p>
          <p>Open <a href="${process.env.FRONTEND_URL}/messages" style='color:#10b981;'>BuzzMitra</a> to catch up.</p>
          <br />
          <p>Thanks,<br />BuzzMitra</p>
        </div>`,
      });
    }

    return { message: "Notification sent." };
  }
);

export const functions = [sendNewConnectionRequestReminder, sendNotificationOfUnseenMessages];
