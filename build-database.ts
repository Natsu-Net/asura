/// <reference lib="deno.unstable" />
import { load } from "$std/dotenv/mod.ts";
import AsuraParser from "./parser/sites/asura.ts";
import { Manga, Chapter } from "./utils/manga.ts";
import { storeManga, getMangaBySlug } from "./utils/fetcher.ts";
import { openKv } from "./utils/kv.ts";

// Migration function to clean up slugs
export async function migrateToCleanSlugs() {
	console.log("🔄 Starting slug migration to clean format...");
	const kv = await openKv();
	
	try {
		// Get all manga slugs from index
		const mangaIndexResult = await kv.get(["manga_index"]);
		const mangaSlugs = (mangaIndexResult.value as string[]) || [];
		
		const parser = new AsuraParser();
		const migratedSlugs: string[] = [];
		
		for (const oldSlug of mangaSlugs) {
			// Check if this slug has a hash suffix
			if (/-[a-f0-9]{8,}$/i.test(oldSlug)) {
				console.log(`Migrating slug: ${oldSlug}`);
				
				// Get the manga data
				const detailsResult = await kv.get(["manga_details", oldSlug]);
				const chaptersResult = await kv.get(["manga_chapters", oldSlug]);
				
				if (detailsResult.value && chaptersResult.value) {
					const mangaDetails = detailsResult.value as Manga;
					const mangaChapters = chaptersResult.value as Chapter[];
					
					// Generate clean slug
					let cleanSlug = parser.getSlugFromTitle(mangaDetails.originalSlug || mangaDetails.title);
					if (!cleanSlug || cleanSlug.length < 3) {
						cleanSlug = parser.getSlugFromUrl(`/series/${oldSlug}`);
					}
					
					// Only migrate if the clean slug is different
					if (cleanSlug !== oldSlug) {
						console.log(`  ${oldSlug} -> ${cleanSlug}`);
						
						// Check if clean slug already exists
						const existingResult = await kv.get(["manga_details", cleanSlug]);
						if (!existingResult.value) {
							// Migrate the data
							mangaDetails.slug = cleanSlug;
							await kv.set(["manga_details", cleanSlug], mangaDetails);
							await kv.set(["manga_chapters", cleanSlug], mangaChapters);
							
							// Migrate chapter content
							for (const chapter of mangaChapters) {
								const chapterContentResult = await kv.get(["chapter_content", oldSlug, chapter.number]);
								if (chapterContentResult.value) {
									await kv.set(["chapter_content", cleanSlug, chapter.number], chapterContentResult.value);
									await kv.delete(["chapter_content", oldSlug, chapter.number]);
								}
							}
							
							// Delete old entries
							await kv.delete(["manga_details", oldSlug]);
							await kv.delete(["manga_chapters", oldSlug]);
							
							migratedSlugs.push(cleanSlug);
						} else {
							console.log(`  Clean slug ${cleanSlug} already exists, skipping migration`);
							migratedSlugs.push(oldSlug); // Keep the old one
						}
					} else {
						migratedSlugs.push(oldSlug); // No change needed
					}
				}
			} else {
				migratedSlugs.push(oldSlug); // Already clean
			}
		}
		
		// Update the manga index with migrated slugs
		await kv.set(["manga_index"], migratedSlugs);
		console.log(`✅ Slug migration completed. Processed ${mangaSlugs.length} manga, migrated to clean slugs.`);
		
	} catch (error) {
		console.error("❌ Slug migration failed:", error);
	} finally {
		kv.close();
	}
}

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

	for await (const manga of parser.getMangaList()) {
		console.log("Processing:", manga.title);
		
		// Enhanced manga detection - check multiple slug variations
		let existingManga = await getMangaBySlug(manga.slug);
		
		// If not found by current slug, try to find by originalSlug or title similarity
		if (!existingManga && manga.originalSlug) {
			existingManga = await getMangaBySlug(manga.originalSlug);
			if (existingManga) {
				console.log(`Found existing manga by originalSlug: ${manga.originalSlug}`);
			}
		}
		
		// If still not found, try to find by title similarity (fallback)
		if (!existingManga) {
			// Create a local findMangaByTitle function since we can't import it
			existingManga = await findMangaByTitleLocal(manga.title);
			if (existingManga) {
				console.log(`Found similar manga by title: "${existingManga.title}"`);
			}
		}
		
		if (existingManga) {
			// Update existing manga with new information
			const updatedManga = {
				...existingManga,
				imgUrl: manga.imgUrl || existingManga.imgUrl,
				url: manga.url || existingManga.url,
				Followers: manga.Followers > 0 ? manga.Followers : existingManga.Followers,
				Rating: manga.Rating > 0 ? manga.Rating : existingManga.Rating,
				Updated_On: new Date(),
				// Keep the existing slug to avoid breaking URLs, but update originalSlug if needed
				originalSlug: manga.originalSlug || existingManga.originalSlug,
			};

			// Parse new chapters if available
			if (manga.parseChapters) {
				try {
					const chap = await manga.parseChapters();
					
					// Create a map of existing chapters by number to avoid duplicates
					const existingChapterMap = new Map<string, Chapter>();
					existingManga.chapters.forEach(chapter => {
						existingChapterMap.set(String(chapter.number), chapter);
					});
					
					// Add only new chapters, with enhanced deduplication
					const newChapters = chap.chapters.filter((chapter: Chapter) => {
						const chapterNumber = String(chapter.number);
						const existingChapter = existingChapterMap.get(chapterNumber);
						
						if (!existingChapter) {
							return true; // New chapter
						}
						
						// Chapter exists - check if we should update it with better title
						const newTitle = chapter.title.trim();
						const existingTitle = existingChapter.title.trim();
						
						// Prefer cleaner titles (shorter, more standard format)
						if (newTitle.length < existingTitle.length && newTitle.match(/^Chapter\s+[0-9]+$/i)) {
							// Replace with cleaner title
							existingChapter.title = newTitle;
							return false; // Don't add as new, we updated existing
						}
						
						return false; // Chapter already exists, skip
					});
					
					if (newChapters.length > 0) {
						console.log(`Found ${newChapters.length} new chapters for ${manga.title}`);
						
						// Merge existing and new chapters, remove duplicates
						const allChapters = [...existingManga.chapters, ...newChapters];
						const uniqueChapters = Array.from(
							new Map(allChapters.map(ch => [String(ch.number), ch])).values()
						);
						
						// Sort chapters by number descending
						uniqueChapters.sort((a, b) => parseFloat(String(b.number)) - parseFloat(String(a.number)));
						
						updatedManga.chapters = uniqueChapters;
					} else {
						// No new chapters, keep existing ones
						updatedManga.chapters = existingManga.chapters;
					}
				} catch (error) {
					console.error(`Error parsing chapters for ${manga.title}:`, error);
					updatedManga.chapters = existingManga.chapters;
				}
			} else {
				// No parseChapters function, keep existing chapters
				updatedManga.chapters = existingManga.chapters;
			}

			// Remove parseChapters function before storing
			delete manga.parseChapters;
			delete updatedManga.parseChapters;

			await storeManga(updatedManga);
			console.log(`Updated ${manga.title}`);
		} else {
			// New manga
			if (manga.parseChapters) {
				try {
					const chap = await manga.parseChapters();
					
					// Remove duplicates in new manga chapters as well with enhanced logic
					const chapterMap = new Map<string, Chapter>();
					for (const ch of chap.chapters) {
						const number = String(ch.number);
						const existing = chapterMap.get(number);
						
						if (!existing) {
							chapterMap.set(number, ch);
						} else {
							// Keep the chapter with the cleaner title
							const newTitle = ch.title.trim();
							const existingTitle = existing.title.trim();
							
							if (newTitle.length < existingTitle.length && newTitle.match(/^Chapter\s+[0-9]+$/i)) {
								chapterMap.set(number, ch); // Replace with cleaner title
							}
						}
					}
					
					const uniqueChapters = Array.from(chapterMap.values());
					
					// Sort chapters by number descending
					uniqueChapters.sort((a: Chapter, b: Chapter) => parseFloat(String(b.number)) - parseFloat(String(a.number)));
					
					manga.chapters = uniqueChapters;
				} catch (error) {
					console.error(`Error parsing chapters for new manga ${manga.title}:`, error);
					manga.chapters = [];
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
	const kv = await openKv();
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

// Helper function to clean duplicates and migrate old structure
async function cleanDatabase() {
	console.log("Cleaning database...");
	const kv = await openKv();
	
	try {
		const seen = new Set<string>();
		const toDelete: string[] = [];
		
		// Check for duplicate manga in old structure
		const iter = kv.list({ prefix: ["manga"] });
		for await (const entry of iter) {
			const manga = entry.value as Manga;
			const key = entry.key as string[];
			
			if (key.length === 2 && key[0] === "manga") {
				if (seen.has(manga.slug)) {
					toDelete.push(key[1]);
				} else {
					seen.add(manga.slug);
				}
			}
		}
		
		// Delete duplicates
		for (const slug of toDelete) {
			await kv.delete(["manga", slug]);
			console.log(`Deleted duplicate manga: ${slug}`);
		}
		
		// Clean up old chapter structure if it exists
		const oldChapters = kv.list({ prefix: ["chapters"] });
		let oldChapterCount = 0;
		for await (const entry of oldChapters) {
			await kv.delete(entry.key);
			oldChapterCount++;
		}
		
		if (oldChapterCount > 0) {
			console.log(`Cleaned up ${oldChapterCount} old chapter entries`);
		}
		
	} finally {
		kv.close();
	}
	
	console.log("Finished cleaning database");
}

// Helper function to migrate old structure to new structure
async function migrateToNewStructure() {
	console.log("Migrating to new KV structure...");
	const kv = await openKv();
	
	try {
		const iter = kv.list({ prefix: ["manga"] });
		for await (const entry of iter) {
			const manga = entry.value as Manga;
			const key = entry.key as string[];
			
			if (key.length === 2 && key[0] === "manga") {
				console.log(`Migrating ${manga.title}...`);
				await storeManga(manga);
				
				// Delete old entry
				await kv.delete(key);
			}
		}
	} finally {
		kv.close();
	}
	
	console.log("Migration complete");
}

// Local helper function to find manga by title similarity
async function findMangaByTitleLocal(title: string): Promise<Manga | null> {
	const kv = await openKv();
	
	try {
		// Get all manga from the index
		const mangaIndexResult = await kv.get(["manga_index"]);
		const mangaSlugs = (mangaIndexResult.value as string[]) || [];
		
		// Normalize the search title
		const normalizedSearchTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
		
		// Check each manga for title similarity
		for (const slug of mangaSlugs) {
			const manga = await getMangaBySlug(slug);
			if (manga) {
				const normalizedMangaTitle = manga.title.toLowerCase().replace(/[^a-z0-9]/g, '');
				
				// Check for exact match or high similarity
				if (normalizedMangaTitle === normalizedSearchTitle || 
					normalizedMangaTitle.includes(normalizedSearchTitle) || 
					normalizedSearchTitle.includes(normalizedMangaTitle)) {
					
					// Additional check: if titles are very similar (within 3 character difference)
					const titleDiff = Math.abs(normalizedMangaTitle.length - normalizedSearchTitle.length);
					if (titleDiff <= 3) {
						console.log(`Found similar manga: "${manga.title}" matches "${title}"`);
						return manga;
					}
				}
			}
		}
		
		return null;
	} catch (error) {
		console.error("Error finding manga by title:", error);
		return null;
	} finally {
		kv.close();
	}
}

// Helper function to check for and clean up duplicate manga entries
async function checkForDuplicates() {
	console.log("🔍 Checking for duplicate manga entries...");
	const kv = await openKv();
	
	try {
		const mangaIndexResult = await kv.get(["manga_index"]);
		const mangaSlugs = (mangaIndexResult.value as string[]) || [];
		
		const titleMap = new Map<string, string[]>();
		const duplicates: Array<{title: string, slugs: string[]}> = [];
		
		// Group manga by title
		for (const slug of mangaSlugs) {
			const manga = await getMangaBySlug(slug);
			if (manga && manga.title) {
				const title = manga.title.trim();
				if (!titleMap.has(title)) {
					titleMap.set(title, []);
				}
				titleMap.get(title)!.push(slug);
			}
		}
		
		// Find duplicates
		for (const [title, slugs] of titleMap.entries()) {
			if (slugs.length > 1) {
				duplicates.push({ title, slugs });
				console.log(`⚠️  Duplicate found: "${title}" has ${slugs.length} entries: ${slugs.join(', ')}`);
			}
		}
		
		if (duplicates.length === 0) {
			console.log("✅ No duplicate manga entries found");
		} else {
			console.log(`⚠️  Found ${duplicates.length} manga with duplicate entries`);
			
			// Clean up duplicates by keeping the one with the most chapters
			for (const duplicate of duplicates) {
				let bestSlug = duplicate.slugs[0];
				let maxChapters = 0;
				
				for (const slug of duplicate.slugs) {
					const manga = await getMangaBySlug(slug);
					if (manga && manga.chapters && manga.chapters.length > maxChapters) {
						maxChapters = manga.chapters.length;
						bestSlug = slug;
					}
				}
				
				console.log(`  Keeping "${duplicate.title}" with slug "${bestSlug}" (${maxChapters} chapters)`);
				
				// Remove duplicate entries
				for (const slug of duplicate.slugs) {
					if (slug !== bestSlug) {
						console.log(`    Removing duplicate slug: ${slug}`);
						
						// Delete manga details and chapters
						await kv.delete(["manga_details", slug]);
						await kv.delete(["manga_chapters", slug]);
						
						// Delete chapter content
						const chaptersResult = await kv.get(["manga_chapters", slug]);
						if (chaptersResult.value) {
							const chapters = chaptersResult.value as Chapter[];
							for (const chapter of chapters) {
								await kv.delete(["chapter_content", slug, String(chapter.number)]);
							}
						}
						
						// Remove from index
						const indexResult = await kv.get(["manga_index"]);
						const index = (indexResult.value as string[]) || [];
						const updatedIndex = index.filter(s => s !== slug);
						await kv.set(["manga_index"], updatedIndex);
					}
				}
			}
		}
		
	} catch (error) {
		console.error("❌ Error checking for duplicates:", error);
	} finally {
		kv.close();
	}
}

// Only run main logic when file is executed directly (not imported)
if (import.meta.main) {
	await checkForNewDomains();
	await migrateToNewStructure(); // Migrate old data first
	await main();
	await cleanDatabase();
	await checkForDuplicates(); // Check for duplicates after cleaning
}

export {
	checkForNewDomains,
	main,
	cleanDatabase,
	migrateToNewStructure
};