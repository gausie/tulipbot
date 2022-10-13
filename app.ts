import { KoLBot } from "kol-chatbot";
import * as dotenv from "dotenv";
import { IncomingMessage, KoLClient } from "kol-chatbot/dist/KoLClient";
import { addTulips, checkTulips, getCachedPrices } from "./flowers.js";
import { db } from "./db.js";
dotenv.config()

function createBot() {
    const username = process.env.USERNAME;
    const password = process.env.PASSWORD;

    if (username === undefined || password === undefined) {
        throw("Must specify a USERNAME and PASSWORD environment variable");
    }

    return new KoLBot(username, password);
}

async function handle(bot: KoLBot, msg: IncomingMessage) {
    if (msg.type === "kmail") {
        await addTulips(msg);
    } else if (msg.type === "whisper") {
        await handleWhisper(bot, msg);
    }
}

async function handleWhisper(bot: KoLBot, msg: IncomingMessage) {
    console.log(`Message from ${msg.who.name} -> ${msg.msg}`);
    const id = Number(msg.who.id);
    const args = msg.msg.split(" ");
    const row = await db.get("SELECT * FROM players WHERE id = ?", id);
    switch (args[0]) {
        case "help":
            await bot.sendKmail(id, `balance: See your tulip and chroner balance\nprices: See current prices\nsell @ n: Sell your tulips if they are being bought at n or higher\nSoon you'll be able to buy... but not yet`)
            return msg.reply("You have been sent a kmail with usage instructions");
        case "sell":
            if (!row) return msg.reply("You don't have a balance here, send me some tulips first");
            const match = msg.msg.match(/sell (?:@ ?)?(\d+)\s*$/);
            if (!match) return msg.reply(`Cannot understand sell command. You are currently selling at ${row["sellAt"]}`);
            const sellAt = Number(match[1]);
            if (sellAt > 28) return msg.reply("This script author doesn't believe they sell at higher than 28");
            await db.run("UPDATE players SET sellAt = ? WHERE id = ?", [sellAt, id]);
            return msg.reply(`Now selling tulips at ${sellAt} chroner`);
        case "buy": {
            if (!row) return msg.reply("You don't have a balance here, send me some tulips first");
            return msg.reply(`Buying not implemented yet, sorry. We'll let you spend your ${row["chroner"]} chroner(s) before the event is over`);
        }
        case "prices": {
            const { red, white, blue } = getCachedPrices();
            return msg.reply(`Current prices are: ${red} for red, ${white} for white and ${blue} for blue`);
        }
        case "balance": {
            if (!row) return msg.reply("You don't have a balance here, send me some tulips first");
            return msg.reply(`Your balance is ${row["red"]} red tulip(s), ${row["white"]} white tulip(s), ${row["blue"]} blue tulip(s), and ${row["chroner"]} chroner(s)`);
        }
    }
}

async function main() {
    const bot = createBot();
    const client: KoLClient = bot["_client"];

    await client.logIn();

    bot.start((msg) => handle(bot, msg));

    await checkTulips(bot, client);
    setInterval(() => checkTulips(bot, client), 60000);
}

main();
