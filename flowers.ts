import { KoLBot } from "kol-chatbot";
import { IncomingMessage, KoLClient } from "kol-chatbot/dist/KoLClient";
import { db } from "./db.js";

const ids = {red: 8670, white: 8669, blue: 8671};
const colours = ["red", "white", "blue"] as const;
type TulipColour = typeof colours[number];

const getRow = (c: TulipColour) => 760 + colours.indexOf(c);

const tulipPrice = /<b>Chroner<\/b>&nbsp;<b>\((\d+)\)<\/b>.*?alt="(.*?) tulip\"/g;

let currentPrices: { [colour in TulipColour]: number } = { red: 0, white: 0, blue: 0};

export function getCachedPrices() {
    return currentPrices;
}

async function getTulipPrices(client: KoLClient): Promise<{ [colour in TulipColour]: number }> {
   const page = await client.visitUrl("shop.php?whichshop=flowertradein");
   currentPrices = Object.fromEntries(Array.from(page.matchAll(tulipPrice)).map(m => [m[2], Number(m[1])]));
   return currentPrices;
}

type Plan =  { playerId: number, playerName: string, colour: TulipColour, quantity: number, price: number };

export async function checkTulips(bot: KoLBot, client: KoLClient) {
    const prices = await getTulipPrices(client);

    console.log(`Checked prices: ${JSON.stringify(prices)}`);

    const planned = [] as Plan[];

    await db.each("SELECT * FROM players", (err, row) => {
        const sellAt = row["sellAt"] as number;
        const id = row["id"] as number;
        colours.forEach((colour) => {
            const quantity = row[colour];
            if (quantity > 0 && prices[colour] >= sellAt) {
                console.log(`Selling ${quantity} x ${colour} for ${row["name"]} (at ${prices[colour]}, their min was ${sellAt})`);
                planned.push({ playerId: id, playerName: row["name"], colour, quantity, price: prices[colour] });
            }
        });
    });

    const succeeded = [] as Plan[];
    const failed = [] as Plan[];

    for (const plan of planned) {
        const result: string = await client.visitUrl(`shop.php?whichshop=flowertradein&action=buyitem&quantity=${plan.quantity}&whichrow=${getRow(plan.colour)}`);
        if (result.includes("You don't have enough")) {
            failed.push(plan);
        } else {
            succeeded.push(plan);
        }
    }

    for (const plan of succeeded) {
        if (!colours.includes(plan.colour)) continue; // Last minute check to stop sql injection
        bot.sendKmail(plan.playerId, `Congratulations, you just sold ${plan.quantity} x ${plan.colour} tulip(s) for ${plan.price}!\n\The chroner have been added to your balance`);
        await db.run("UPDATE players SET " + plan.colour + " = 0, chroner = chroner + ? WHERE id = ?", [plan.quantity * plan.price, plan.playerId]);
    }

    for (const plan of failed) {
        console.log(`Failed to sell ${plan.quantity} x ${plan.colour} for ${plan.playerName}`);
    }
}

const itemPattern = /<table class="item" style="float: none" rel="id=(\d+).*?&n=(\d+).*?">/g;

export async function addTulips(msg: IncomingMessage) {
    const id = Number(msg.who.id);
    const tulips = Object.fromEntries(Array.from(msg.msg.matchAll(itemPattern)).map(m => [Number(m[1]), Number(m[2])]).filter(([k, ]) => Object.values(ids).includes(k)));
    const red = tulips[ids["red"]] || 0;
    const white = tulips[ids["white"]] || 0;
    const blue = tulips[ids["blue"]] || 0;

    const exists = await db.get("SELECT 1 FROM players WHERE id = ?", id);

    if (!exists) {
        await db.run("INSERT INTO players VALUES (?, ?, ?, ?, ?, ?, ?)", [id, msg.who.name, 28, red, white, blue, 0]);
    } else {
        console.log(`Adding tulips to ${msg.who.name} (${red} red, ${white} white, ${blue} blue)`)
        await db.run("UPDATE players SET red = red + ?, white = white + ?, blue = blue + ? WHERE id = ?", [red, white, blue, id]);
    }
}