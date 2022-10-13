import { KoLBot } from "kol-chatbot";
import * as dotenv from "dotenv";
import { dedent } from "ts-dedent";
import { IncomingMessage, KoLClient } from "kol-chatbot/dist/KoLClient";
import { addTulips, checkTulips, getCachedPrices } from "./flowers.js";
import { db, Player } from "./db.js";
import { buy } from "./spender.js";
dotenv.config()

function createBot() {
    const username = process.env.USERNAME;
    const password = process.env.PASSWORD;

    if (username === undefined || password === undefined) {
        throw("Must specify a USERNAME and PASSWORD environment variable");
    }

    return new KoLBot(username, password);
}

async function handle(bot: KoLBot, client: KoLClient, msg: IncomingMessage) {
    if (msg.type === "kmail") {
        await addTulips(msg);
    } else if (msg.type === "whisper") {
        await handleWhisper(bot, client, msg);
    }
}

async function handleWhisper(bot: KoLBot, client: KoLClient, msg: IncomingMessage) {
    console.log(`Message from ${msg.who.name} -> ${msg.msg}`);
    const id = Number(msg.who.id);
    const args = msg.msg.split(" ");
    const row = await db.get("SELECT * FROM players WHERE id = ?", id) as Player;

    if (args.length < 1) {
        return msg.reply("Don't send me blank messages >:(");
    }

    switch (args[0].toLowerCase()) {
        case "help":
            await bot.sendKmail(id, dedent`
                Hello! This is tulipbot, a (probably) short-lived bot by gausie to make sure you get a good deal on your ttttulips. Here is how the bot is used:

                balance: See your tulip and Chroner balance
                prices: See current prices
                sell @ <min>: Set your minimum tulip sell price to <min>
                sell: Tells you your current minimum tulip sell price
                buy [quantity] <item name>: Buy items with your Chroner balance. If no quantity is specified, it'll buy 1.
            `);
            return msg.reply("You have been sent a kmail with usage instructions");
        case "sell":
            if (!row) return msg.reply("You don't have a balance here, send me some tulips first");
            if (args.length === 1) return msg.reply(`You are currently selling at ${row["sellAt"]}`);
            const match = msg.msg.match(/sell (?:@ ?)?(\d+)\s*$/);
            if (!match) return msg.reply(`Cannot understand sell command.`);
            const sellAt = Number(match[1]);
            if (sellAt > 28) return msg.reply("This script author doesn't believe they sell at higher than 28");
            await db.run("UPDATE players SET sellAt = ? WHERE id = ?", [sellAt, id]);
            return msg.reply(`Now selling tulips at ${sellAt} chroner`);
        case "buy": {
            if (!row) return msg.reply("You don't have a balance here, send me some tulips first");
            // return msg.reply("Not working yet...");
            return buy(bot, client, row, msg);
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

    bot.start((msg) => handle(bot, client, msg));

    await checkTulips(bot, client);
    setInterval(() => checkTulips(bot, client), 60000);
}

main();
