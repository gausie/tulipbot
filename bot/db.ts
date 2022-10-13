// @ts-ignore
import sqlite3 from "sqlite3";
import { open } from "sqlite";

async function createDb() {
  const db = await open({ filename: "./tulip.db", driver: sqlite3.Database });
  await db.run(
    "CREATE TABLE IF NOT EXISTS players (id INT, name CHAR, sellAt INT, red INT, white INT, blue INT, chroner INT)"
  );
  await db.run(
    "CREATE TABLE IF NOT EXISTS prices (id INTEGER PRIMARY KEY AUTOINCREMENT, red INT, white INT, blue INT, time INT)"
  );
  return db;
}

export type Player = {
  id: number;
  name: string;
  sellAt: number;
  red: number;
  white: number;
  blue: number;
  chroner: number;
};

export const db = await createDb();
