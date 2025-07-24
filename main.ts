/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />

import { start } from "$fresh/server.ts";
import manifest from "./fresh.gen.ts";

import twindPlugin from "$fresh/plugins/twind.ts";
import twindConfig from "./twind.config.ts";

// Import database functions
import { checkForNewDomains, main as updateDatabase, cleanDatabase, migrateToCleanSlugs } from "./build-database.ts";

// Schedule database update to run every 30 minutes
Deno.cron("Update manga database", "*/30 * * * *", async () => {
	try {
		console.log("Starting scheduled database update...");
		const startTime = Date.now();

		// Check for domain changes first
		await checkForNewDomains();

		// Update the database
		await updateDatabase();

		// Clean up duplicates
		await cleanDatabase();

		const duration = Date.now() - startTime;
		console.log(`Database update completed successfully in ${duration}ms`);
	} catch (error) {
		console.error("Scheduled database update failed:", error);
		// Don't throw - let the retry mechanism handle it
	}
});

// Optional: Schedule a weekly full database cleanup
Deno.cron("Weekly database cleanup", "0 2 * * SUN", async () => {
	try {
		console.log("Starting weekly database cleanup...");
		await cleanDatabase();
		console.log("Starting slug migration to clean format...");
		await migrateToCleanSlugs();
		console.log("Weekly database cleanup and migration completed");
	} catch (error) {
		console.error("Weekly database cleanup failed:", error);
	}
});

console.log("Cron jobs registered: database update every 30 minutes, cleanup every Sunday at 2am UTC");

await start(manifest, { plugins: [twindPlugin(twindConfig)] });
