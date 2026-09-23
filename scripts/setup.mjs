import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  closeSync,
  openSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
const path = new URL("../.env", import.meta.url);
if (!existsSync(path))
  writeFileSync(
    path,
    readFileSync(new URL("../.env.example", import.meta.url), "utf8"),
  );
const source = readFileSync(path, "utf8");
if (source.includes("replace-this-with-a-long-random-session-secret"))
  writeFileSync(
    path,
    source.replace(
      "replace-this-with-a-long-random-session-secret",
      randomBytes(32).toString("hex"),
    ),
  );
mkdirSync(new URL("../prisma", import.meta.url), { recursive: true });
const database = new URL("../prisma/dev.db", import.meta.url);
if (!existsSync(database)) closeSync(openSync(database, "a"));
console.log(
  "Local environment and SQLite file ready. Existing data preserved.",
);
