const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const { Api } = require("telegram");
const path = require("path");
const fs = require("fs-extra");
require("dotenv").config();

const { appendMessage, appendEdit, appendDelete } = require("./fileWriter");
const { getLocalTime, ensureDayFolder } = require("./utils");
const { processLargeBackup } = require("./backupEmail");

const apiId = parseInt(process.env.API_ID);
const apiHash = process.env.API_HASH;
const session = new StringSession(process.env.SESSION);

const MAX_MEDIA_SIZE = 25 * 1024 * 1024;

async function saveMedia(client, msg) {
  if (!msg.media) return null;

  let fileSize = 0;

  if (msg.media.document?.size) fileSize = msg.media.document.size;
  else if (msg.media.photo?.sizes?.length)
    fileSize = msg.media.photo.sizes.at(-1)?.size || 0;

  if (fileSize > MAX_MEDIA_SIZE) {
    console.warn("MEDIA SKIPPED:", fileSize);
    return `SKIPPED_${Math.round(fileSize / 1024 / 1024)}MB`;
  }

  const dir = ensureDayFolder();
  const mediaDir = path.join(dir, "media");
  fs.ensureDirSync(mediaDir);

  let ext = "bin";
  if (msg.media.photo) ext = "jpg";
  else if (msg.media.document?.mimeType?.includes("video")) ext = "mp4";
  else if (msg.media.document?.mimeType?.includes("audio")) ext = "ogg";

  const fullPath = path.join(mediaDir, `msg_${msg.id}.${ext}`);

  try {
    const buffer = await client.downloadMedia(msg.media);
    fs.writeFileSync(fullPath, buffer);
    return path.basename(fullPath);
  } catch (e) {
    console.error("Media save error:", e.message);
    return null;
  }
}

async function startListener() {
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start();
  await client.connect();

  const me = await client.getMe();
  const meId = me.id;
  const meName = me.username || me.firstName || "Me";

  console.log(`>>> LOGGED AS ${meName} (ID ${meId})`);

  client.addEventHandler(async (event) => {
    try {
      const msg = event.message;
      const chat = await msg.getChat();
      const sender = await msg.getSender();
      if (!chat) return;

      const isOutgoing = msg.out || sender?.id === meId;
      const direction = isOutgoing ? "OUTGOING" : "INCOMING";

      let chatType, chatName, from, to;

      if (chat.className === "User") {
        chatType = "private";

        const chatUserName =
          chat.username || chat.firstName || `user${chat.id}`;

        if (chat.id === meId) {
          chatName = "saved_messages";
          from = meName + " (me)";
          to = meName + " (me)";
        } else if (isOutgoing) {
          chatName = chatUserName;
          from = meName + " (me)";
          to = chatUserName;
        } else {
          chatName = chatUserName;
          from = chatUserName;
          to = meName + " (me)";
        }
      }

      const text = msg.message || "";
      const media = await saveMedia(client, msg);

      appendMessage({
        chatId: msg.chatId,
        chatName,
        chatType,
        direction,
        from,
        to,
        text,
        media,
      });

      await processLargeBackup(path.join(__dirname, "backup"));

      // ✅ КРАСИВИЙ ВИВІД ТЕКСТ + МЕДІА
      let logContent = "";

      if (text && text.trim().length > 0) {
        logContent = text;
      }

      if (media) {
        if (logContent.length > 0) {
          logContent += ` [MEDIA:${media}]`;
        } else {
          logContent = media; // ✅ тільки імʼя файлу
        }
      }

      if (!logContent) {
        logContent = "(empty message)";
      }

      console.log(`[${getLocalTime()}] ${from} -> ${to}: ${logContent}`);

    } catch (err) {
      console.error("Listener error:", err.message);
    }
  }, new NewMessage({}));

  client.addEventHandler(async (u) => {
    if (!(u instanceof Api.UpdateEditMessage)) return;

    const m = u.message;
    appendEdit(m.id, "chat", "?", m.message || "");
  });

  client.addEventHandler(async (u) => {
    if (!(u instanceof Api.UpdateDeleteMessages)) return;
    for (const id of u.messages) appendDelete(id, "chat");
  });
}

module.exports = { startListener };
