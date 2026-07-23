import { Expo } from "expo-server-sdk";
import prisma from "../lib/prisma.js";

const expo = new Expo();

export const sendPushNotification = async ({ targetUserId, title, body, data = {} }) => {
  try {
    // Fetch all active device tokens associated with this user
    const deviceTokens = await prisma.deviceToken.findMany({
      where: { userId: targetUserId },
      select: { token: true },
    });

    // Fallback check to User table in case legacy entries exist
    let tokens = deviceTokens.map((d) => d.token);

    if (tokens.length === 0) {
      const fallbackUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { pushToken: true },
      });
      if (fallbackUser?.pushToken) {
        tokens.push(fallbackUser.pushToken);
      }
    }

    if (tokens.length === 0) {
      console.warn(`[Push Notification] Skipping: User ${targetUserId} has no registered push tokens.`);
      return;
    }

    // Filter and build message payload for valid Expo push tokens
    const messages = [];
    for (const pushToken of tokens) {
      if (!Expo.isExpoPushToken(pushToken)) {
        console.error(`[Push Notification] Invalid token format skipped: ${pushToken}`);
        continue;
      }

      messages.push({
        to: pushToken,
        sound: "default",
        title,
        body,
        data,
      });
    }

    if (messages.length === 0) return;

    // Chunk and transmit through Expo servers
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      console.log("[Push Notification] Sent successfully:", ticketChunk);
    }
  } catch (error) {
    console.error("[Push Notification Error]:", error);
  }
};