const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
require("dotenv").config();

const apiId = parseInt(process.env.API_ID);
const apiHash = process.env.API_HASH;
const session = new StringSession("");

async function authenticate() {
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });

  console.log(">>> Logging into Telegram...");

  await client.start({
    phoneNumber: async () => await input.text("Phone number: "),
    password: async () => await input.text("Password: "),
    phoneCode: async () => await input.text("Code: "),
    onError: (e) => console.log(e),
  });

  console.log(">>> Your session string:");
  console.log(client.session.save());

  process.exit(0);
}

authenticate();
