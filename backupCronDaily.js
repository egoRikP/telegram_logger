const cron = require("node-cron");
const path = require("path");
const { processLargeBackup } = require("./backupEmail");

cron.schedule("0 3 * * *", async () => {
  const backupDir = path.join(__dirname, "backup");
  console.log("DAILY FULL BACKUP");
  await processLargeBackup(backupDir, true);
});
