import nextEnv from "@next/env";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const mode = process.argv[2] || "dev";
nextEnv.loadEnvConfig(root, mode === "dev");
const args = process.argv.slice(3);
const portFlag = args.findIndex((v) => v === "--port" || v === "-p");
process.env.PORT =
  portFlag >= 0 ? args[portFlag + 1] : process.env.PORT || "3000";
const child = spawn(
  process.execPath,
  [
    require.resolve("next/dist/bin/next"),
    mode,
    fileURLToPath(new URL("../apps/frontend", import.meta.url)),
    ...(mode === "build" ? [] : ["--hostname", "127.0.0.1"]),
    ...args,
  ],
  { cwd: root, stdio: "inherit", env: process.env },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
