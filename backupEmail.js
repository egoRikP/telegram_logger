const fs = require("fs-extra");
const path = require("path");
const nodemailer = require("nodemailer");
const archiver = require("archiver");
require("dotenv").config();

const MAX_FILE_SIZE = 400 * 1024 * 1024; 

const MAX_EMAIL_PART = 24 * 1024 * 1024;

let lastBackupTime = 0;
let backupInProgress = false;

// ✅ РОЗМІР УСІЄЇ ПАПКИ
function getFolderSize(dir) {
  let size = 0;
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) size += getFolderSize(full);
    else size += stat.size;
  }
  return size;
}

// ✅ ZIP ВСІЄЇ ПАПКИ
function zipFolder(inputDir, zipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    archive.on("error", reject);

    archive.pipe(output);
    archive.directory(inputDir, false);
    archive.finalize();
  });
}

function splitZip(zipPath) {
  const buffer = fs.readFileSync(zipPath);
  const parts = [];
  let index = 1;

  for (let i = 0; i < buffer.length; i += MAX_EMAIL_PART) {
    const partPath = `${zipPath}.part${index}`;
    fs.writeFileSync(partPath, buffer.slice(i, i + MAX_EMAIL_PART));
    parts.push(partPath);
    index++;
  }

  return parts;
}

async function sendEmailParts(files, title) {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  let i = 1;
  for (const file of files) {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_TO,
      subject: `${title}${files.length > 1 ? " – part " + i : ""}`,
      text: `Telegram backup file ${i}`,
      attachments: [{ filename: path.basename(file), path: file }],
    });
    i++;
  }
}

// ✅ ФІНАЛЬНИЙ BACKUP БЕЗ ГОНКИ
async function processLargeBackup(folderPath, force = false) {
  if (backupInProgress) {
    console.log("⏸ Backup already in progress — skip");
    return false;
  }

  if (!fs.existsSync(folderPath)) return false;

  const size = getFolderSize(folderPath);
  console.log("BACKUP TOTAL SIZE:", (size / 1024 / 1024).toFixed(2), "MB");

  if (!force && size < MAX_FILE_SIZE) return false;

  const now = Date.now();
  if (!force && now - lastBackupTime < 30 * 60 * 1000) return false;

  backupInProgress = true;
  lastBackupTime = now;

  const zipPath = `${folderPath}_${now}.zip`;

  try {
    console.log("ZIP FULL BACKUP START...");
    await zipFolder(folderPath, zipPath);

    const stat = fs.statSync(zipPath);

    if (stat.size <= MAX_EMAIL_PART) {
      await sendEmailParts([zipPath], "Telegram FULL Backup");
    } else {
      const parts = splitZip(zipPath);
      await sendEmailParts(parts, "Telegram FULL Backup (PARTS)");
    }

    fs.emptyDirSync(folderPath);

    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

    const leftovers = fs.readdirSync(path.dirname(zipPath))
      .filter(f => f.startsWith(path.basename(zipPath)));

    for (const file of leftovers) {
      fs.unlinkSync(path.join(path.dirname(zipPath), file));
    }

    console.log("✅ FULL BACKUP SENT & ALL CLEANED");

    return true;

  } catch (err) {
    console.error("❌ BACKUP ERROR:", err.message);
    return false;

  } finally {
    backupInProgress = false;
  }
}

module.exports = { processLargeBackup };
