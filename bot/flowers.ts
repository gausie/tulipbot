import * as fs from "node:fs/promises";
import { KoLBot } from "kol-chatbot";
import { IncomingMessage, KoLClient } from "kol-chatbot/dist/KoLClient";
import { dedent } from "ts-dedent";
import { db } from "./db.js";

export const ids = {
  chroner: 7567,
  rose: 8668,
  red: 8670,
  white: 8669,
  blue: 8671,
} as const;
const colours = ["red", "white", "blue"] as const;
type TulipColour = typeof colours[number];

const getRow = (c: TulipColour) => 760 + colours.indexOf(c);

const tulipPrice =
  /<b>Chroner<\/b>&nbsp;<b>\((\d+)\)<\/b>.*?alt="(.*?) tulip\"/g;

let currentPrices: { [colour in TulipColour]: number } = {
  red: -1,
  white: -1,
  blue: -1,
};

export function getCachedPrices() {
  return currentPrices;
}

async function getTulipPrices(
  client: KoLClient
): Promise<{ [colour in TulipColour]: number }> {
  const minutes = new Date().getMinutes() % 30;

  // Check at 1 and 16 minutes in to each 30 minute window
  // +1 to the expected 0 and 30 to account for KoL lag and two checks to be extra certain
  if (currentPrices.red < 0 || minutes === 1 || minutes === 16) {
    const page = await client.visitUrl("shop.php?whichshop=flowertradein");
    const prices = Object.fromEntries(
      Array.from(page.matchAll(tulipPrice)).map((m) => [m[2], Number(m[1])])
    );

    if (!prices) {
      // Sometimes this page can fail?
      await fs.writeFile(`PRICES_ERROR_${Date.now()}.html`, page);
      return currentPrices;
    }

    const last = await db.get(
      "SELECT * FROM prices ORDER BY time DESC LIMIT 1"
    );

    if (
      last.red !== prices.red &&
      last.white !== prices.white &&
      last.blue !== prices.blue
    ) {
      await db.run(
        "INSERT INTO prices (red,white,blue,time) VALUES(?, ?, ?, ?)",
        [prices.red, prices.white, prices.blue, Date.now()]
      );

      console.log(`Checked prices: ${JSON.stringify(prices)}`);
    } else if (currentPrices.red < 0) {
      console.log("Bot just restarted and prices are still the same");
    }

    currentPrices = prices;
  }

  return currentPrices;
}

export async function checkStock(client: KoLClient) {
  const expected = await db.get(
    "SELECT SUM(red) as red, SUM(white) as white, SUM(blue) as blue, SUM(chroner) as chroner FROM players"
  );
  const inventory = await client.visitUrl(
    "api.php?what=inventory&for=tulipbot"
  );
  const actual = Object.fromEntries(
    colours.map((c) => [c, Number(inventory[String(ids[c])] || 0)] as const)
  ) as { [key in TulipColour]: number };
  colours.forEach((c) => {
    const missing = expected[c] - actual[c];
    if (missing !== 0) {
      console.log(
        `WARNING: ${missing > 0 ? "MISSING" : "EXTRA"} ${Math.abs(
          missing
        )} ${c.toUpperCase()} TULIPS`
      );
    }
  });

  const actualChroner = Number(inventory[String(ids.chroner)] || 0);
  const missingChroner = expected["chroner"] - actualChroner;
  if (missingChroner !== 0) {
    console.log(
      `WARNING: ${missingChroner > 0 ? "MISSING" : "EXTRA"} ${Math.abs(
        missingChroner
      )} CHRONER`
    );
  }
}

async function sell(client: KoLClient, row: number, quantity: number) {
  const result: string = await client.visitUrl(
    `shop.php?whichshop=flowertradein&action=buyitem&quantity=${quantity}&whichrow=${row}`
  );
  if (result.includes("You don't have enough")) {
    await fs.writeFile(`BUY_ERROR_${Date.now()}.html`, result);
    return false;
  } else {
    return true;
  }
}

type Plan = {
  playerId: number;
  playerName: string;
  colour: TulipColour;
  quantity: number;
  price: number;
  balance: number;
};

export async function checkTulips(bot: KoLBot, client: KoLClient) {
  const prices = await getTulipPrices(client);

  const planned = [] as Plan[];

  await db.each(
    "SELECT * FROM players WHERE (red > 0 AND sellAt <= ?) OR (white > 0 AND sellAt <= ?) OR (blue > 0 AND sellAt <= ?)",
    [prices.red, prices.white, prices.blue],
    (err, row) => {
      const sellAt = row["sellAt"] as number;
      const id = row["id"] as number;
      colours.forEach((colour) => {
        const quantity = row[colour];
        if (quantity > 0 && prices[colour] >= sellAt) {
          console.log(
            `Selling ${quantity} x ${colour} for ${row["name"]} (at ${prices[colour]}, their min was ${sellAt})`
          );
          planned.push({
            playerId: id,
            playerName: row["name"],
            colour,
            quantity,
            price: prices[colour],
            balance: row["chroner"] + quantity * prices[colour],
          });
        }
      });
    }
  );

  const succeeded = [] as Plan[];
  const failed = [] as Plan[];

  for (const plan of planned) {
    const success = await sell(client, getRow(plan.colour), plan.quantity);
    if (success) {
      succeeded.push(plan);
    } else {
      failed.push(plan);
    }
  }

  for (const plan of succeeded) {
    if (!colours.includes(plan.colour)) continue; // Last minute check to stop sql injection
    bot.sendKmail(
      plan.playerId,
      dedent`
        Congratulations, you just sold ${plan.quantity} x ${plan.colour} tulip(s) for ${plan.price}!

        The chroner have been added to your balance, which is now ${plan.balance}.
      `
    );
    await db.run(
      "UPDATE players SET " +
        plan.colour +
        " = 0, chroner = chroner + ? WHERE id = ?",
      [plan.quantity * plan.price, plan.playerId]
    );
  }

  for (const plan of failed) {
    console.log(
      `Failed to sell ${plan.quantity} x ${plan.colour} for ${plan.playerName}`
    );
  }
}

const itemPattern =
  /<table class="item" style="float: none" rel="id=(\d+).*?&n=(\d+).*?">/g;

export async function addTulips(client: KoLClient, msg: IncomingMessage) {
  const id = Number(msg.who.id);
  const items = Object.fromEntries(
    Array.from(msg.msg.matchAll(itemPattern))
      .map((m) => [Number(m[1]), Number(m[2])])
      .filter(([k]) => Object.values(ids).includes(k as any))
  );
  const red = items[ids.red] || 0;
  const white = items[ids.white] || 0;
  const blue = items[ids.blue] || 0;
  const rose = items[ids.rose] || 0;

  if (red + white + blue + rose === 0) {
    return msg.reply(dedent`
      I didn't see any items I look for in your message. If that was a donation, thank you!

      If you sent things in a gift package, they haven't been counted. They'll have to be returned manually, which is not guaranteed. This is annoying - please read the instructions in future.
    `);
  }

  const chroner = Math.floor(rose / 2);

  if (chroner > 0) {
    await sell(client, 759, chroner);
  }

  const exists = await db.get("SELECT 1 FROM players WHERE id = ?", id);

  if (!exists) {
    console.log(
      `Adding tulips to new user ${msg.who.name} (${red} red, ${white} white, ${blue} blue, ${chroner} chroner)`
    );

    await db.run("INSERT INTO players VALUES (?, ?, ?, ?, ?, ?, ?)", [
      id,
      msg.who.name,
      28,
      red,
      white,
      blue,
      chroner,
    ]);
  } else {
    console.log(
      `Adding tulips to existing user ${msg.who.name} (${red} red, ${white} white, ${blue} blue, ${chroner} chroner)`
    );

    await db.run(
      "UPDATE players SET red = red + ?, white = white + ?, blue = blue + ?, chroner = chroner + ? WHERE id = ?",
      [red, white, blue, chroner, id]
    );
  }
}

export async function warnTulips(bot: KoLBot) {
  const accounts = await db.all(
    "SELECT * FROM players WHERE red > 0 OR white > 0 OR blue > 0 OR chroner > 0"
  );

  for (const account of accounts) {
    await bot.sendKmail(
      account.id,
      "Reminder: the tower goes away today at rollover (just over 4 hours from now). Remember to use your Chroner balance before then, and consider setting your sell price very low. Lots of love, gausie <3"
    );
  }
}
