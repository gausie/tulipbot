// @ts-ignore
import sqlite3 from "sqlite3";
import { open } from "sqlite";

async function createDb() {
    const db = await open({ filename: "./tulip.db", driver: sqlite3.Database });
    await db.run("CREATE TABLE IF NOT EXISTS players (id INT, name CHAR, sellAt INT, red INT, white INT, blue INT, chroner INT)");
    return db;
}

export const db = await createDb();
