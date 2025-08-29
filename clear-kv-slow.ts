/// <reference lib="deno.unstable" />
import { openKv } from "./utils/kv.ts";

async function clearAllKvEntriesSlowly() {
	console.log("⚠️  WARNING: This will delete ALL entries in the KV store!");
	console.log("This will run SLOWLY to avoid rate limits.");
	console.log("Press Ctrl+C to cancel, or wait 5 seconds to continue...");
	
	// Give user time to cancel
	await new Promise(resolve => setTimeout(resolve, 5000));
	
	const kv = await openKv();
	
	try {
		console.log("🗑️  Starting to delete all KV entries (slow mode)...");
		
		let count = 0;
		let errors = 0;
		const entries = kv.list({ prefix: [] });
		const keysToDelete = [];
		
		// First, collect all keys
		for await (const entry of entries) {
			keysToDelete.push(entry.key);
		}
		
		console.log(`Found ${keysToDelete.length} entries to delete`);
		console.log("This will take approximately", Math.ceil(keysToDelete.length / 60), "minutes");
		
		// Delete one by one with 1 second delay between each
		for (const key of keysToDelete) {
			try {
				await kv.delete(key);
				count++;
				
				// Show progress every 10 items
				if (count % 10 === 0) {
					const percent = Math.round((count / keysToDelete.length) * 100);
					console.log(`  Progress: ${count}/${keysToDelete.length} (${percent}%)`);
				}
			} catch (error) {
				errors++;
				// If we get an error, wait longer before continuing
				console.log(`Rate limit hit, waiting 5 seconds...`);
				await new Promise(resolve => setTimeout(resolve, 5000));
				
				// Retry the same key
				try {
					await kv.delete(key);
					count++;
				} catch (retryError) {
					console.error(`Failed to delete key ${JSON.stringify(key)} even after retry`);
				}
			}
			
			// Wait 1 second between each deletion to avoid rate limits
			await new Promise(resolve => setTimeout(resolve, 1000));
		}
		
		console.log(`✅ Successfully deleted ${count} entries from KV store`);
		if (errors > 0) {
			console.log(`⚠️  Encountered ${errors} errors (but may have succeeded on retry)`);
		}
	} catch (error) {
		console.error("❌ Error clearing KV store:", error);
	} finally {
		kv.close();
	}
}

// Run if executed directly
if (import.meta.main) {
	await clearAllKvEntriesSlowly();
}

export { clearAllKvEntriesSlowly };
