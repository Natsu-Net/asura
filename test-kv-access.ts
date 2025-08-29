/// <reference lib="deno.unstable" />
import { openKv } from "./utils/kv.ts";

async function testKvAccess() {
	const kv = await openKv();
	
	try {
		console.log("🔍 Testing KV access...\n");
		
		// Test 1: Can we list entries?
		console.log("Test 1: Listing entries...");
		const entries = kv.list({ prefix: [] });
		let count = 0;
		for await (const entry of entries) {
			count++;
			if (count === 1) {
				console.log("✅ Can list entries");
				console.log("   First entry key:", JSON.stringify(entry.key));
			}
			if (count >= 5) break;
		}
		console.log(`   Total accessible entries: ${count}+\n`);
		
		// Test 2: Can we read a specific entry?
		console.log("Test 2: Reading a specific entry...");
		const testRead = await kv.get(["manga_index"]);
		if (testRead.value) {
			console.log("✅ Can read entries");
			const indexLength = (testRead.value as string[]).length;
			console.log(`   Manga index contains ${indexLength} entries\n`);
		} else {
			console.log("⚠️  No manga_index found\n");
		}
		
		// Test 3: Can we write a test entry?
		console.log("Test 3: Writing a test entry...");
		const testKey = ["_test_", "can_delete", Date.now()];
		try {
			await kv.set(testKey, { test: true, timestamp: new Date() });
			console.log("✅ Can write entries");
			
			// Test 4: Can we delete the test entry?
			console.log("\nTest 4: Deleting the test entry...");
			await kv.delete(testKey);
			console.log("✅ Can delete entries");
		} catch (writeError) {
			console.log("❌ Cannot write entries:", writeError.message);
			
			// If we can't write, we definitely can't delete
			console.log("\nTest 4: Delete test skipped (no write access)");
		}
		
		// Test 5: Check KV metadata
		console.log("\n📊 KV Database Info:");
		console.log("   Environment:", Deno.env.get("DENO_KV_ACCESS_TOKEN") ? "Production (remote)" : "Development (local)");
		console.log("   Database URL:", Deno.env.get("DENO_KV_DATABASE_URL") || "Not set");
		
	} catch (error) {
		console.error("❌ Error testing KV:", error);
	} finally {
		kv.close();
	}
}

// Run if executed directly
if (import.meta.main) {
	await testKvAccess();
}
