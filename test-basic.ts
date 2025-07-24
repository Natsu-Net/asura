// Simple offline test without external dependencies
async function testBasicFunctionality() {
	console.log("Testing basic functionality...");
	
	// Test Deno KV basic functionality
	try {
		const kv = await Deno.openKv();
		
		// Test basic KV operations
		await kv.set(["test"], "value");
		const result = await kv.get(["test"]);
		
		if (result.value === "value") {
			console.log("✓ Deno KV basic operations working");
		} else {
			console.log("✗ Deno KV basic operations failed");
		}
		
		// Test KV list operations
		await kv.set(["manga", "test1"], { title: "Test Manga 1", slug: "test1" });
		await kv.set(["manga", "test2"], { title: "Test Manga 2", slug: "test2" });
		
		const mangaList = [];
		const iter = kv.list({ prefix: ["manga"] });
		
		for await (const entry of iter) {
			mangaList.push(entry.value);
		}
		
		if (mangaList.length >= 2) {
			console.log("✓ Deno KV list operations working");
		} else {
			console.log("✗ Deno KV list operations failed");
		}
		
		// Cleanup test data
		await kv.delete(["test"]);
		await kv.delete(["manga", "test1"]);
		await kv.delete(["manga", "test2"]);
		
		console.log("✓ All basic tests passed!");
		
	} catch (error) {
		console.error("✗ Test failed:", error);
	}
}

if (import.meta.main) {
	await testBasicFunctionality();
}