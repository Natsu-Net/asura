/// <reference lib="deno.unstable" />
import { load } from "$std/dotenv/mod.ts";
import AsuraParser from "./parser/sites/asura.ts";
import { Manga, Chapter } from "./utils/manga.ts";
import { storeManga, getMangaBySlug, getAllMangaSlugs } from "./utils/fetcher.ts";
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

/**
 * Normalize slug by removing trailing patterns like "-23723"
 * Removes the last dash and any following numbers
 */
function normalizeSlug(slug: string): string {
  // Remove trailing pattern: last dash followed by numbers
  return slug.replace(/-[0-9]+$/, '');
}

/**
 * Generate a clean slug from title
 */
function generateCleanSlug(title: string): string {
  return title
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/**
 * Check if domain is still accessible and update if needed
 */
async function checkAndUpdateDomain(): Promise<void> {
  console.log("🔍 Checking domain accessibility...");
  const kv = await openKv();
  
  try {
    // Get stored domain configuration
    const domainConfig = await kv.get(["config", "domain"]);
    if (domainConfig.value) {
      parser.domain = domainConfig.value as string;
    }

    const currentDomain = new URL(parser.domain);
    
    // Check if domain is still accessible
    try {
      const response = await fetch(currentDomain, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (response.status === 200) {
        console.log("✅ Domain is accessible:", currentDomain.href);
        return;
      }

      // If redirected, update domain
      const location = response.headers.get("location");
      if (location) {
        const newDomain = new URL(location);
        console.log("🔄 Domain redirected, updating to:", newDomain.href);
        parser.domain = newDomain.href;
        
        // Store new domain
        await kv.set(["config", "domain"], newDomain.href);
        console.log("✅ Updated domain in database");
      }
    } catch (error) {
      console.log("⚠️  Error checking domain:", error);
    }
  } finally {
    kv.close();
  }
}

/**
 * Migrate existing manga to normalized slugs
 */
async function migrateToNormalizedSlugs(): Promise<void> {
  console.log("🔄 Starting slug normalization migration...");
  const kv = await openKv();
  
  try {
    const mangaIndexResult = await kv.get(["manga_index"]);
    const mangaSlugs = (mangaIndexResult.value as string[]) || [];
    
    if (mangaSlugs.length === 0) {
      console.log("ℹ️  No manga to migrate");
      return;
    }
    
    const migratedSlugs: string[] = [];
    let migratedCount = 0;
    
    for (const oldSlug of mangaSlugs) {
      const normalizedSlug = normalizeSlug(oldSlug);
      
      if (normalizedSlug !== oldSlug) {
        console.log(`🔄 Migrating slug: ${oldSlug} -> ${normalizedSlug}`);
        
        // Get the manga data
        const detailsResult = await kv.get(["manga_details", oldSlug]);
        const chaptersResult = await kv.get(["manga_chapters", oldSlug]);
        
        if (detailsResult.value && chaptersResult.value) {
          const mangaDetails = detailsResult.value as Manga;
          const mangaChapters = chaptersResult.value as Chapter[];
          
          // Check if normalized slug already exists
          const existingResult = await kv.get(["manga_details", normalizedSlug]);
          if (!existingResult.value) {
            // Migrate the data
            mangaDetails.slug = normalizedSlug;
            await kv.set(["manga_details", normalizedSlug], mangaDetails);
            await kv.set(["manga_chapters", normalizedSlug], mangaChapters);
            
            // Migrate chapter content
            for (const chapter of mangaChapters) {
              const chapterContentResult = await kv.get(["chapter_content", oldSlug, chapter.number]);
              if (chapterContentResult.value) {
                await kv.set(["chapter_content", normalizedSlug, chapter.number], chapterContentResult.value);
                await kv.delete(["chapter_content", oldSlug, chapter.number]);
              }
            }
            
            // Delete old entries
            await kv.delete(["manga_details", oldSlug]);
            await kv.delete(["manga_chapters", oldSlug]);
            
            migratedCount++;
            migratedSlugs.push(normalizedSlug);
          } else {
            console.log(`  ⚠️  Normalized slug ${normalizedSlug} already exists, keeping old slug`);
            migratedSlugs.push(oldSlug);
          }
        } else {
          console.log(`  ⚠️  No data found for ${oldSlug}, skipping`);
          migratedSlugs.push(oldSlug);
        }
      } else {
        migratedSlugs.push(oldSlug); // No change needed
      }
    }
    
    // Update the manga index with migrated slugs
    await kv.set(["manga_index"], migratedSlugs);
    console.log(`✅ Slug migration completed. Processed ${mangaSlugs.length} manga, migrated ${migratedCount} slugs.`);
    
  } catch (error) {
    console.error("❌ Slug migration failed:", error);
  } finally {
    kv.close();
  }
}

/**
 * Find existing manga by title similarity
 */
async function findMangaByTitle(title: string): Promise<Manga | null> {
  const kv = await openKv();
  
  try {
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
            console.log(`🔍 Found similar manga: "${manga.title}" matches "${title}"`);
            return manga;
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("❌ Error finding manga by title:", error);
    return null;
  } finally {
    kv.close();
  }
}

/**
 * Process a single manga - either update existing or create new
 */
async function processManga(manga: Manga): Promise<void> {
  try {
    // Normalize the slug
    const normalizedSlug = normalizeSlug(manga.slug);
    if (normalizedSlug !== manga.slug) {
      console.log(`🔄 Normalizing slug: ${manga.slug} -> ${normalizedSlug}`);
      manga.slug = normalizedSlug;
    }
    
    // Try to find existing manga
    let existingManga = await getMangaBySlug(manga.slug);
    
    // If not found by current slug, try to find by originalSlug or title similarity
    if (!existingManga && manga.originalSlug) {
      const normalizedOriginalSlug = normalizeSlug(manga.originalSlug);
      existingManga = await getMangaBySlug(normalizedOriginalSlug);
      if (existingManga) {
        console.log(`🔍 Found existing manga by originalSlug: ${manga.originalSlug}`);
      }
    }
    
    // If still not found, try to find by title similarity
    if (!existingManga) {
      existingManga = await findMangaByTitle(manga.title);
      if (existingManga) {
        console.log(`🔍 Found similar manga by title: "${existingManga.title}"`);
      }
    }
    
    if (existingManga) {
      // Update existing manga
      await updateExistingManga(existingManga, manga);
    } else {
      // Create new manga
      await createNewManga(manga);
    }
  } catch (error) {
    console.error(`❌ Error processing manga ${manga.title}:`, error);
  }
}

/**
 * Update existing manga with new information
 */
async function updateExistingManga(existingManga: Manga, newManga: Manga): Promise<void> {
  console.log(`📝 Updating existing manga: ${existingManga.title}`);
  
  // Update manga information
  const updatedManga = {
    ...existingManga,
    imgUrl: newManga.imgUrl || existingManga.imgUrl,
    url: newManga.url || existingManga.url,
    Followers: newManga.Followers > 0 ? newManga.Followers : existingManga.Followers,
    Rating: newManga.Rating > 0 ? newManga.Rating : existingManga.Rating,
    Updated_On: new Date(),
    originalSlug: newManga.originalSlug || existingManga.originalSlug,
  };

  // Parse new chapters if available
  if (newManga.parseChapters) {
    try {
      const chap = await newManga.parseChapters();
      
      // Create a map of existing chapters by number
      const existingChapterMap = new Map<string, Chapter>();
      existingManga.chapters.forEach(chapter => {
        existingChapterMap.set(String(chapter.number), chapter);
      });
      
      // Add only new chapters
      const newChapters = chap.chapters.filter((chapter: Chapter) => {
        const chapterNumber = String(chapter.number);
        return !existingChapterMap.has(chapterNumber);
      });
      
      if (newChapters.length > 0) {
        console.log(`📚 Found ${newChapters.length} new chapters for ${newManga.title}`);
        
        // Merge existing and new chapters
        const allChapters = [...existingManga.chapters, ...newChapters];
        const uniqueChapters = Array.from(
          new Map(allChapters.map(ch => [String(ch.number), ch])).values()
        );
        
        // Sort chapters by number descending
        uniqueChapters.sort((a, b) => parseFloat(String(b.number)) - parseFloat(String(a.number)));
        
        updatedManga.chapters = uniqueChapters;
      } else {
        updatedManga.chapters = existingManga.chapters;
      }
    } catch (error) {
      console.error(`❌ Error parsing chapters for ${newManga.title}:`, error);
      updatedManga.chapters = existingManga.chapters;
    }
  } else {
    updatedManga.chapters = existingManga.chapters;
  }

  // Remove parseChapters function before storing
  delete (updatedManga as any).parseChapters;

  await storeManga(updatedManga);
  console.log(`✅ Updated ${newManga.title}`);
}

/**
 * Create new manga entry
 */
async function createNewManga(manga: Manga): Promise<void> {
  console.log(`🆕 Creating new manga: ${manga.title}`);
  
  // Parse chapters if available
  if (manga.parseChapters) {
    try {
      const chap = await manga.parseChapters();
      
      // Remove duplicates in new manga chapters
      const chapterMap = new Map<string, Chapter>();
      for (const ch of chap.chapters) {
        const number = String(ch.number);
        if (!chapterMap.has(number)) {
          chapterMap.set(number, ch);
        }
      }
      
      const uniqueChapters = Array.from(chapterMap.values());
      
      // Sort chapters by number descending
      uniqueChapters.sort((a: Chapter, b: Chapter) => parseFloat(String(b.number)) - parseFloat(String(a.number)));
      
      manga.chapters = uniqueChapters;
    } catch (error) {
      console.error(`❌ Error parsing chapters for new manga ${manga.title}:`, error);
      manga.chapters = [];
    }
  } else {
    manga.chapters = [];
  }

  // Remove the parseChapters function before storing
  delete (manga as any).parseChapters;
  
  await storeManga(manga);
  console.log(`✅ Created ${manga.title} with ${manga.chapters.length} chapters`);
}

/**
 * Clean up duplicate manga entries
 */
async function cleanupDuplicates(): Promise<void> {
  console.log("🧹 Checking for duplicate manga entries...");
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
      return;
    }
    
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
      
      console.log(`  🏆 Keeping "${duplicate.title}" with slug "${bestSlug}" (${maxChapters} chapters)`);
      
      // Remove duplicate entries
      for (const slug of duplicate.slugs) {
        if (slug !== bestSlug) {
          console.log(`    🗑️  Removing duplicate slug: ${slug}`);
          
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
    
  } catch (error) {
    console.error("❌ Error cleaning up duplicates:", error);
  } finally {
    kv.close();
  }
}

/**
 * Main function to process all manga
 */
async function main(): Promise<void> {
  console.log("🚀 Starting database update for:", parser.domain);
  
  try {
    // Check and update domain if needed
    await checkAndUpdateDomain();
    
    // Migrate existing manga to normalized slugs
    await migrateToNormalizedSlugs();
    
    // Process all manga from the parser
    let processedCount = 0;
    for await (const manga of parser.getMangaList()) {
      console.log(`\n📖 Processing ${++processedCount}: ${manga.title}`);
      await processManga(manga);
    }
    
    // Clean up duplicates
    await cleanupDuplicates();
    
    // Store the last update timestamp
    const kv = await openKv();
    const now = new Date();
    await kv.set(["config", "lastUpdate"], now.toISOString());
    console.log(`\n⏰ Last update timestamp stored: ${now.toISOString()}`);
    kv.close();
    
    console.log("\n✅ Database update completed successfully!");
    
  } catch (error) {
    console.error("❌ Database update failed:", error);
    throw error;
  }
}

// Only run main logic when file is executed directly (not imported)
if (import.meta.main) {
  await main();
}

export {
  main,
  normalizeSlug,
  generateCleanSlug,
  migrateToNormalizedSlugs,
  cleanupDuplicates,
  checkAndUpdateDomain
};