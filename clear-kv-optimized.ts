/// <reference lib="deno.unstable" />
import { openKv } from "./utils/kv.ts";

async function clearAllKvEntriesOptimized() {
	console.log("⚠️  WARNING: This will delete ALL entries in the KV store!");
	console.log("This will automatically find the optimal deletion rate.");
	console.log("Press Ctrl+C to cancel, or wait 5 seconds to continue...");
	
	// Give user time to cancel
	await new Promise(resolve => setTimeout(resolve, 5000));
	
	const kv = await openKv();
	
	try {
		console.log("🗑️  Starting optimized KV deletion...");
		
		let count = 0;
		let errors = 0;
		let consecutiveSuccesses = 0;
		let consecutiveErrors = 0;
		
		// Adaptive parameters
		let batchSize = 10; // Start with 10 items per batch
		let delayMs = 100; // Start with 100ms delay between items
		let batchDelayMs = 1000; // Start with 1 second between batches
		
		const entries = kv.list({ prefix: [] });
		const keysToDelete = [];
		
		// First, collect all keys
		for await (const entry of entries) {
			keysToDelete.push(entry.key);
		}
		
		console.log(`Found ${keysToDelete.length} entries to delete`);
		console.log("Starting with batch size:", batchSize, "and delay:", delayMs, "ms");
		
		// Process in adaptive batches
		for (let i = 0; i < keysToDelete.length; i += batchSize) {
			const batch = keysToDelete.slice(i, Math.min(i + batchSize, keysToDelete.length));
			let batchErrors = 0;
			let batchSuccesses = 0;
			
			for (const key of batch) {
				try {
					await kv.delete(key);
					count++;
					batchSuccesses++;
					consecutiveSuccesses++;
					consecutiveErrors = 0;
					
					// Small delay between items in batch
					if (delayMs > 0) {
						await new Promise(resolve => setTimeout(resolve, delayMs));
					}
				} catch (error) {
					errors++;
					batchErrors++;
					consecutiveErrors++;
					consecutiveSuccesses = 0;
					
					// If we hit an error, back off immediately
					console.log(`⚠️  Rate limit hit at item ${count}/${keysToDelete.length}`);
					
					// Exponential backoff
					const backoffMs = Math.min(30000, batchDelayMs * Math.pow(2, consecutiveErrors));
					console.log(`   Backing off for ${backoffMs/1000} seconds...`);
					await new Promise(resolve => setTimeout(resolve, backoffMs));
					
					// Retry the failed key
					try {
						await kv.delete(key);
						count++;
						batchSuccesses++;
						consecutiveErrors = 0;
					} catch (retryError) {
						console.error(`   Failed even after backoff`);
					}
				}
			}
			
			// Adaptive rate adjustment based on batch performance
			if (batchErrors === 0 && consecutiveSuccesses >= batchSize * 3) {
				// If we've had 3 successful batches, try to speed up
				if (batchSize < 50) {
					batchSize = Math.min(50, Math.floor(batchSize * 1.5));
					console.log(`✨ Increasing batch size to ${batchSize}`);
				} else if (delayMs > 50) {
					delayMs = Math.max(50, Math.floor(delayMs * 0.8));
					console.log(`✨ Decreasing delay to ${delayMs}ms`);
				} else if (batchDelayMs > 500) {
					batchDelayMs = Math.max(500, Math.floor(batchDelayMs * 0.8));
					console.log(`✨ Decreasing batch delay to ${batchDelayMs}ms`);
				}
			} else if (batchErrors > 0) {
				// If we had errors, slow down
				if (batchSize > 1) {
					batchSize = Math.max(1, Math.floor(batchSize * 0.5));
					console.log(`🐢 Reducing batch size to ${batchSize}`);
				}
				delayMs = Math.min(2000, Math.floor(delayMs * 1.5));
				batchDelayMs = Math.min(10000, Math.floor(batchDelayMs * 1.5));
				console.log(`🐢 Increasing delays to ${delayMs}ms per item, ${batchDelayMs}ms per batch`);
			}
			
			// Progress report
			if (count % 100 === 0 || i + batchSize >= keysToDelete.length) {
				const percent = Math.round((count / keysToDelete.length) * 100);
				const rate = batchSize / ((batchSize * delayMs + batchDelayMs) / 1000);
				const remainingTime = Math.ceil((keysToDelete.length - count) / rate / 60);
				console.log(`📊 Progress: ${count}/${keysToDelete.length} (${percent}%) - Rate: ${rate.toFixed(1)} items/sec - ETA: ${remainingTime} minutes`);
			}
			
			// Delay between batches
			if (i + batchSize < keysToDelete.length) {
				await new Promise(resolve => setTimeout(resolve, batchDelayMs));
			}
		}
		
		console.log(`\n✅ Successfully deleted ${count} entries from KV store`);
		if (errors > 0) {
			console.log(`⚠️  Encountered ${errors} errors (most were retried)`);
		}
		console.log(`🎯 Final optimal settings: batch=${batchSize}, delay=${delayMs}ms, batchDelay=${batchDelayMs}ms`);
		
	} catch (error) {
		console.error("❌ Error clearing KV store:", error);
	} finally {
		kv.close();
	}
}

// Run if executed directly
if (import.meta.main) {
	await clearAllKvEntriesOptimized();
}

export { clearAllKvEntriesOptimized };
