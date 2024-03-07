/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />

import "$std/dotenv/load.ts";

import { start } from "$fresh/server.ts";
import manifest from "./fresh.gen.ts";

import twindPlugin from "$fresh/plugins/twind.ts";
import twindConfig from "./twind.config.ts";
// import {checkforNewDomains,main,CleanDatabase} from "./build-database.ts"

// Deno.cron("Check for update", "*/10 * * * *", async() => {
// 	await checkforNewDomains();
// 	await main();
// 	await CleanDatabase();
// });

await start(manifest, { plugins: [twindPlugin(twindConfig)] });
