const fs = require("fs-extra");
const path = require("path");
const { ensureDayFolder } = require("./utils");

async function appendMessage({ chatId, chatName, chatType, direction, from, to, text, media }) {
  const dir = ensureDayFolder();
  const safeName = chatName.replace(/[^a-z0-9_а-яіїє\-]/gi, "_");
  const base = `${chatType}_${safeName}_${chatId}`;

  const txtPath = path.join(dir, `${base}.txt`);
  const jsonPath = path.join(dir, `${base}.json`);

  const entry =
`[${new Date().toISOString()}] [${chatType}] [${direction}] ${from} -> ${to}
${text}${media ? ` [MEDIA:${media}]` : ""}

`;

  fs.appendFileSync(txtPath, entry);

  let arr = [];
  if (fs.existsSync(jsonPath)) {
    try {
      arr = JSON.parse(fs.readFileSync(jsonPath));
    } catch {
      arr = [];
    }
  }

  arr.push({
    timestamp: new Date().toISOString(),
    chatType, direction, from, to, text, media
  });

  fs.writeFileSync(jsonPath, JSON.stringify(arr, null, 2));
}

function appendEdit(msgId, chatId, oldText, newText) {
  const dir = ensureDayFolder();
  const p = path.join(dir, "edits.log");

  fs.appendFileSync(p,
`[${new Date().toISOString()}] EDIT msgId=${msgId} chatId=${chatId}
OLD: ${oldText || "<empty>"}
NEW: ${newText || "<empty>"}

`);
}

function appendDelete(msgId, chatId) {
  const dir = ensureDayFolder();
  const p = path.join(dir, "deleted.log");

  fs.appendFileSync(p,
`[${new Date().toISOString()}] DELETE msgId=${msgId} chatId=${chatId}

`);
}

module.exports = { appendMessage, appendEdit, appendDelete };
