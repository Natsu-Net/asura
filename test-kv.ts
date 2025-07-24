// Simple test to verify Deno KV functionality
import { storeManga, getMangaBySlug, ServerFetcher } from "./utils/fetcher.ts";

async function testKV() {
	console.log("Testing Deno KV functionality...");
	
	// Test manga object
	const testManga = {
		slug: "test-manga",
		title: "Test Manga",
		genres: ["Action", "Adventure"],
		imgUrl: "https://example.com/image.jpg",
		url: "https://example.com/manga/test",
		chapters: [
			{
				title: "Chapter 1",
				url: "https://example.com/chapter/1",
				date: "2025-01-01",
				number: "1",
				pages: ["page1.jpg", "page2.jpg"]
			}
		],
		Updated_On: new Date(),
		sypnosis: "Test synopsis",
		Followers: 100,
		Rating: 8.5,
		Author: "Test Author",
		Status: "Ongoing"
	};

	try {
		// Test storing manga
		await storeManga(testManga);
		console.log("✓ Successfully stored test manga");

		// Test retrieving manga
		const retrieved = await getMangaBySlug("test-manga");
		if (retrieved && retrieved.title === "Test Manga") {
			console.log("✓ Successfully retrieved test manga");
		} else {
			console.log("✗ Failed to retrieve test manga");
		}

		// Test ServerFetcher
		const result = await ServerFetcher("http://localhost:8000/api?page=1&limit=5");
		console.log("✓ ServerFetcher working, found", result.total, "manga");

		console.log("All KV tests passed!");
	} catch (error) {
		console.error("KV test failed:", error);
	}
}

if (import.meta.main) {
	await testKV();
}