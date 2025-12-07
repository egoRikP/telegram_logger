const fs = require("fs-extra");
const path = require("path");

function getDate() {
  return new Date().toISOString().split("T")[0];
}

function getLocalTime() {
  return new Date().toLocaleTimeString("uk-UA", { hour12: false });
}

function ensureDayFolder() {
  const today = getDate();
  const dir = path.join(__dirname, "backup", today);
  const mediaDir = path.join(dir, "media");

  fs.ensureDirSync(dir);
  fs.ensureDirSync(mediaDir);

  return dir;
}

module.exports = {
  getDate,
  getLocalTime,
  ensureDayFolder,
};
