import { IncomingMessage, KoLBot } from "kol-chatbot";
import { KoLClient } from "kol-chatbot/dist/KoLClient";
import { db, Player } from "./db.js";

type Item = {
  name: string;
  id: number;
  cost: number;
  row: number;
  store: string;
  whichshop: string;
};

const items: Item[] = [
  {
    name: "rack of dinosaur ribs",
    id: 7582,
    cost: 25,
    row: 312,
    store: "The Neandermall",
    whichshop: "caveshop",
  },
  {
    name: "scotch on the rocks",
    id: 7583,
    cost: 25,
    row: 313,
    store: "The Neandermall",
    whichshop: "caveshop",
  },
  {
    name: "wooly loincloth",
    id: 7585,
    cost: 100,
    row: 315,
    store: "The Neandermall",
    whichshop: "caveshop",
  },
  {
    name: "yabba dabba doo rag",
    id: 7584,
    cost: 100,
    row: 314,
    store: "The Neandermall",
    whichshop: "caveshop",
  },
  {
    name: "strange helix fossil",
    id: 7586,
    cost: 300,
    row: 311,
    store: "The Neandermall",
    whichshop: "caveshop",
  },
  {
    name: "dog ointment",
    id: 7687,
    cost: 25,
    row: 316,
    store: "Legitimate Shoe Repair, Inc.",
    whichshop: "shoeshop",
  },
  {
    name: "gumshoes",
    id: 7688,
    cost: 200,
    row: 317,
    store: "Legitimate Shoe Repair, Inc.",
    whichshop: "shoeshop",
  },
  {
    name: "flapper floppers",
    id: 7689,
    cost: 400,
    row: 318,
    store: "Legitimate Shoe Repair, Inc.",
    whichshop: "shoeshop",
  },
  {
    name: "sneakeasies",
    id: 7690,
    cost: 600,
    row: 319,
    store: "Legitimate Shoe Repair, Inc.",
    whichshop: "shoeshop",
  },
  {
    name: "unidentifiable dried fruit",
    id: 7827,
    cost: 25,
    row: 354,
    store: "The Applecalypse Store",
    whichshop: "applestore",
  },
  {
    name: "flat cider",
    id: 7828,
    cost: 50,
    row: 355,
    store: "The Applecalypse Store",
    whichshop: "applestore",
  },
  {
    name: "iShield",
    id: 7824,
    cost: 300,
    row: 356,
    store: "The Applecalypse Store",
    whichshop: "applestore",
  },
  {
    name: "white earbuds",
    id: 7825,
    cost: 600,
    row: 357,
    store: "The Applecalypse Store",
    whichshop: "applestore",
  },
  {
    name: "iFlail",
    id: 7826,
    cost: 900,
    row: 358,
    store: "The Applecalypse Store",
    whichshop: "applestore",
  },
  {
    name: "invisible potion",
    id: 8146,
    cost: 10,
    row: 690,
    store: "Ni&ntilde;a Store",
    whichshop: "nina",
  },
  {
    name: "time shuriken",
    id: 8147,
    cost: 200,
    row: 691,
    store: "Ni&ntilde;a Store",
    whichshop: "nina",
  },
  {
    name: "ninjammies",
    id: 8148,
    cost: 1000,
    row: 692,
    store: "Ni&ntilde;a Store",
    whichshop: "nina",
  },
  {
    name: "rotten tomato",
    id: 8665,
    cost: 25,
    row: 756,
    store: "Ye Newe Souvenir Shoppe",
    whichshop: "shakeshop",
  },
  {
    name: "portable Othello set",
    id: 8664,
    cost: 100,
    row: 755,
    store: "Ye Newe Souvenir Shoppe",
    whichshop: "shakeshop",
  },
  {
    name: "Twelve Night Energy",
    id: 8666,
    cost: 250,
    row: 757,
    store: "Ye Newe Souvenir Shoppe",
    whichshop: "shakeshop",
  },
  {
    name: "Yorick",
    id: 8667,
    cost: 1000,
    row: 758,
    store: "Ye Newe Souvenir Shoppe",
    whichshop: "shakeshop",
  },
  {
    name: "Twitching Television Tattoo",
    id: 9148,
    cost: 1111,
    row: 895,
    store: "KoL Con 13 Merch Table",
    whichshop: "conmerch",
  },
];

function parseMessage(msg: string): [quantity: number, itemName: string] {
  const parts = msg.split(" ");
  if (parts[0] !== "buy") return [0, ""];
  let itemName = "";
  let quantity = parts[1] === "*" ? -1 : Number(parts[1]);
  if (Number.isNaN(quantity)) {
    quantity = 1;
    itemName = parts.slice(1).join(" ");
  } else {
    itemName = parts.slice(2).join(" ");
  }

  return [quantity, itemName];
}

export async function buy(
  bot: KoLBot,
  client: KoLClient,
  row: Player,
  msg: IncomingMessage
) {
  let [quantity, itemName] = parseMessage(msg.msg);
  if (quantity === 0) return msg.reply("Cannot parse message");

  const item = items.find(
    (i) => i.name.toLowerCase() === itemName.toLowerCase()
  );
  if (!item) return msg.reply("Item not recognized");

  const max = Math.floor(row.chroner / item.cost);

  if (quantity === -1) quantity = max;

  if (max < quantity) {
    return msg.reply(
      `You can't afford that many. In fact, you ${
        max === 0 ? "can't afford any!" : `can only afford ${max}.`
      }`
    );
  }

  const result = await client.visitUrl(`shop.php`, {
    whichshop: item.whichshop,
    action: "buyitem",
    whichrow: item.row,
    quantity: quantity,
  });

  if (
    result.includes("You don't have enough") ||
    result.includes("Huh?") ||
    result.includes("That isn't a thing")
  ) {
    console.log(
      `A purchase by ${row.name} failed (${item.name} x ${quantity})`
    );
    return msg.reply("Purchase failed, sorry");
  }

  console.log(
    `A purchase by ${row.name} succeeded! (${item.name} x ${quantity})`
  );
  const spend = quantity * item.cost;
  await db.run("UPDATE players SET chroner = chroner - ? WHERE id = ?", [
    spend,
    row.id,
  ]);
  const creds = client["_credentials"];
  await client.visitUrl(
    "town_sendgift.php",
    {},
    {
      towho: row.id,
      contact: 0,
      note: `Please find attached ${
        item.name
      } x ${quantity}. Your remaining balance is ${
        row.chroner - spend
      } chroner.`,
      insidenote:
        "Enjoy! 10 meat to cover the package would be appreciated but not required",
      whichpackage: 1,
      fromwhere: 0,
      howmany1: quantity,
      whichitem1: item.id,
      sendmeat: 0,
      action: "Yep.",
      pwd: creds?.pwdhash,
    },
    false
  );
  await msg.reply("Your items have been sent via kmail");
}
