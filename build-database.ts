/// <reference lib="deno.unstable" />
import { load } from "$std/dotenv/mod.ts";
import AsuraParser from "./parser/sites/asura.ts";
import { Manga } from "./utils/manga.ts";
import { storeManga, getMangaBySlug } from "./utils/fetcher.ts";
import { openKv } from "./utils/kv.ts";

// Load environment variables
try {
  await load({
    export: true,
    allowEmptyValues: true,
  });
} catch (_error) {
  console.log("Note: .env file not found, using system environment variables");
}

const parser = new AsuraParser();

async function main() {
	console.log("Starting database update for:", parser.domain);
	const kv = await openKv();

	for await (const manga of parser.getMangaList()) {
		console.log("Processing:", manga.title);
		
		// Check if manga already exists
		const existingManga = await getMangaBySlug(manga.slug);
		
		if (existingManga) {
			// Update existing manga with new information
			const updatedManga = {
				...existingManga,
				imgUrl: manga.imgUrl || existingManga.imgUrl,
				url: manga.url || existingManga.url,
				Followers: manga.Followers > 0 ? manga.Followers : existingManga.Followers,
				Rating: manga.Rating > 0 ? manga.Rating : existingManga.Rating,
				Updated_On: new Date(),
			};

			// Check for new chapters
			if (manga.chapters.length > existingManga.chapters.length) {
				console.log(`Found new chapters for ${manga.title}`);
				if (manga.parseChapters) {
					const chap = await manga.parseChapters();
					updatedManga.chapters = chap.chapters;
					
					// Store individual chapters
					for (const chapter of chap.chapters) {
						await kv.set(["chapters", manga.slug, chapter.number], {
							mangaSlug: manga.slug,
							images: chapter.pages,
							title: chapter.title,
							url: chapter.url,
							date: chapter.date,
							number: chapter.number,
						});
					}
				}
			}

			// Remove parseChapters function before storing
			delete manga.parseChapters;
			delete updatedManga.parseChapters;

			await storeManga(updatedManga);
			console.log(`Updated ${manga.title}`);
		} else {
		// New manga
		if (manga.parseChapters) {
			const chap = await manga.parseChapters();
			manga.chapters = chap.chapters;
			
			// Store individual chapters
			for (const chapter of chap.chapters) {
				await kv.set(["chapters", manga.slug, chapter.number], {
					mangaSlug: manga.slug,
					images: chapter.pages,
					title: chapter.title,
					url: chapter.url,
					date: chapter.date,
					number: chapter.number,
				});
			}
		} else {
			manga.chapters = [];
		}

		// Remove the parseChapters function before storing
		delete manga.parseChapters;
		
		await storeManga(manga);
		console.log(`Inserted ${manga.title} with ${manga.chapters.length} chapters`);
		}
	}

	// Store the last update timestamp
	const now = new Date();
	await kv.set(["config", "lastUpdate"], now.toISOString());
	console.log(`Last update timestamp stored: ${now.toISOString()}`);
	
	kv.close();
	console.log("Finished updating database");
}

async function checkForNewDomains() {
	const kv = await openKv();
	
	// Get stored domain configuration
	const domainConfig = await kv.get(["config", "domain"]);
	
	if (domainConfig.value) {
		parser.domain = domainConfig.value as string;
	}

	const oldDomain = new URL(parser.domain);
	
	// Check if domain is still up
	try {
		const response = await fetch(oldDomain, {
			method: "GET",
			redirect: "manual",
		});

		if (response.status === 200) {
			console.log("Domain still up");
			return;
		}

		// If redirected, update domain
		const location = response.headers.get("location");
		if (location) {
			const newDomain = new URL(location);
			console.log("Domain down, updating to:", newDomain.href);
			parser.domain = newDomain.href;
			
			// Store new domain
			await kv.set(["config", "domain"], newDomain.href);
			console.log("Updated domain in database");
		}
	} catch (error) {
		console.log("Error checking domain:", error);
	}
	
	kv.close();
}

// Helper function to get chapter by manga slug and chapter number
async function getChapter(mangaSlug: string, chapterNumber: string) {
	const kv = await openKv();
	const result = await kv.get(["chapters", mangaSlug, chapterNumber]);
	kv.close();
	return result.value;
}

// Helper function to clean duplicates (simplified version)
async function cleanDatabase() {
	console.log("Cleaning database...");
	const kv = await openKv();
	const seen = new Set<string>();
	const toDelete: string[] = [];
	
	// Check for duplicate manga
	const iter = kv.list({ prefix: ["manga"] });
	for await (const entry of iter) {
		const manga = entry.value as Manga;
		const key = entry.key as string[];
		
		if (seen.has(manga.slug)) {
			toDelete.push(key[1]);
		} else {
			seen.add(manga.slug);
		}
	}
	
	// Delete duplicates
	for (const slug of toDelete) {
		await kv.delete(["manga", slug]);
		console.log(`Deleted duplicate manga: ${slug}`);
	}
	
	kv.close();
	console.log("Finished cleaning database");
}

// Only run main logic when file is executed directly (not imported)
if (import.meta.main) {
	await checkForNewDomains();
	await main();
	await cleanDatabase();
}

export {
	checkForNewDomains,
	main,
	cleanDatabase,
	getChapter
};