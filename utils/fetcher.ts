/// <reference lib="deno.unstable" />
import type { Manga, Chapter } from "./manga.ts";
import { openKv } from "./kv.ts";

interface Genre {
	name: string;
	url: string;
}

interface MangaData {
	data: Manga[];
	total: number;
	page: number;
	pagesLeft: number;
	limit: number;
}

// Separate interfaces for the new KV structure
interface MangaDetails {
	slug: string;
	title: string;
	imgUrl: string;
	sypnosis: string;
	url: string;
	genres: string[];
	Updated_On: Date | string;
	Posted_On: Date | string;
	Posted_By: string;
	Author: string;
	Artist: string;
	Rating: number;
	Followers: number;
	Released: string;
	Serialization: string;
	Status: string;
	originalSlug?: string;
}

interface ChapterReference {
	number: string;
	title: string;
	url: string;
	date: string;
}

interface ChapterContent {
	mangaSlug: string;
	number: string;
	title: string;
	url: string;
	date: string;
	pages: string[];
}

// Helper function to filter manga based on search and genres
function filterManga(manga: Manga, search: string, genreSplit: string[]): boolean {
	if (!manga || !manga.title) {
		return false;
	}
	
	let matches = true;
	
	if (search && !manga.title.toLowerCase().includes(search.toLowerCase())) {
		matches = false;
	}
	
	if (genreSplit && genreSplit.length > 0 && genreSplit[0] !== "") {
		const hasGenre = genreSplit.some(genre => 
			manga.genres && manga.genres.includes(genre)
		);
		if (!hasGenre) {
			matches = false;
		}
	}
	
	return matches;
}

export async function ServerFetcher(url: string) {
	const kv = await openKv();
	
	const searchParams = new URL(url).searchParams;

	const page = parseInt(searchParams.get("page") ?? "1");
	const search = searchParams.get("search") ?? "";
	const genres = searchParams.get("genres") ?? "";

	const limit = 10;
	const skip = (page - 1) * limit;
	const a: Manga[] = [];

	const genreSplit = genres.split(",").filter((g) => g.trim() !== "");

	try {
		// Get all manga from the new structure
		const mangaIndexResult = await kv.get(["manga_index"]);
		const mangaSlugs = (mangaIndexResult.value as string[]) || [];
		
		// Fetch manga details for each slug
		for (const slug of mangaSlugs) {
			const manga = await getMangaBySlugInternal(kv, slug);
			if (manga && filterManga(manga, search, genreSplit)) {
				a.push(manga);
			}
		}
	} catch (error) {
		console.error("Error fetching manga:", error);
		// Fallback to old structure if new structure fails
		const iter = kv.list({ prefix: ["manga"] });
		for await (const entry of iter) {
			const manga = entry.value as Manga;
			if (manga && filterManga(manga, search, genreSplit)) {
				a.push(manga);
			}
		}
	}

	// Sort by Updated_On date (newest first)
	a.sort((a, b) => {
		const dateA = new Date(a.Updated_On || 0);
		const dateB = new Date(b.Updated_On || 0);
		return dateB.getTime() - dateA.getTime();
	});

	const total = a.length;
	const paginatedManga = a.slice(skip, skip + limit);
	const pagesLeft = Math.ceil((total - skip - limit) / limit);

	const r = {
		data: paginatedManga,
		total,
		page,
		pagesLeft: Math.max(0, pagesLeft),
		limit,
	};

	kv.close();
	return r as MangaData;
}

// Internal helper that doesn't open/close KV connection
// deno-lint-ignore no-explicit-any
async function getMangaBySlugInternal(kv: any, slug: string): Promise<Manga | null> {
	try {
		// Get manga details
		const detailsResult = await kv.get(["manga_details", slug]);
		if (!detailsResult.value) {
			return null;
		}
		
		const details = detailsResult.value as MangaDetails;
		
		// Get chapter references
		const chaptersResult = await kv.get(["manga_chapters", slug]);
		const chapterRefs = (chaptersResult.value as ChapterReference[]) || [];
		
		// Reconstruct manga object
		const manga: Manga = {
			...details,
			chapters: chapterRefs.map(ref => ({
				number: ref.number,
				title: ref.title,
				url: ref.url,
				date: ref.date,
				pages: [] // Pages loaded separately when needed
			}))
		};
		
		return manga;
	} catch (error) {
		console.error(`Error getting manga ${slug}:`, error);
		return null;
	}
}

// Helper function to store manga in the new KV structure
export async function storeManga(manga: Manga) {
	const kv = await openKv();
	
	try {
		// 1. Store manga details (without chapters)
		const mangaDetails: MangaDetails = {
			slug: manga.slug,
			title: manga.title,
			imgUrl: manga.imgUrl,
			sypnosis: manga.sypnosis,
			url: manga.url,
			genres: manga.genres || [],
			Updated_On: manga.Updated_On,
			Posted_On: manga.Posted_On || new Date(),
			Posted_By: manga.Posted_By || "",
			Author: manga.Author || "",
			Artist: manga.Artist || "",
			Rating: manga.Rating || 0,
			Followers: manga.Followers || 0,
			Released: manga.Released || "",
			Serialization: manga.Serialization || "",
			Status: manga.Status || "",
			originalSlug: manga.originalSlug
		};
		
		await kv.set(["manga_details", manga.slug], mangaDetails);
		
		// 2. Store chapter references (lightweight)
		if (manga.chapters && manga.chapters.length > 0) {
			const chapterRefs: ChapterReference[] = manga.chapters.map(ch => ({
				number: String(ch.number),
				title: ch.title,
				url: ch.url,
				date: ch.date
			}));
			
			await kv.set(["manga_chapters", manga.slug], chapterRefs);
			
			// 3. Store individual chapter content
			for (const chapter of manga.chapters) {
				if (chapter.pages && chapter.pages.length > 0) {
					const pages = Array.isArray(chapter.pages) ? chapter.pages : [chapter.pages];
					const chapterContent: ChapterContent = {
						mangaSlug: manga.slug,
						number: String(chapter.number),
						title: chapter.title,
						url: chapter.url,
						date: chapter.date,
						pages: pages
					};
					
					await kv.set(["chapter_content", manga.slug, String(chapter.number)], chapterContent);
				}
			}
		}
		
		// 4. Update manga index
		const existingIndex = await kv.get(["manga_index"]);
		const mangaIndex = (existingIndex.value as string[]) || [];
		
		if (!mangaIndex.includes(manga.slug)) {
			mangaIndex.push(manga.slug);
			await kv.set(["manga_index"], mangaIndex);
		}
		
		console.log(`Stored manga: ${manga.title} with ${manga.chapters?.length || 0} chapters`);
	} catch (error) {
		console.error(`Error storing manga ${manga.slug}:`, error);
		throw error;
	} finally {
		kv.close();
	}
}

// Helper function to get manga by slug with full chapter data
export async function getMangaBySlug(slug: string): Promise<Manga | null> {
	const kv = await openKv();
	
	try {
		// Get manga details
		const detailsResult = await kv.get(["manga_details", slug]);
		if (!detailsResult.value) {
			return null;
		}
		
		const details = detailsResult.value as MangaDetails;
		
		// Get chapter references
		const chaptersResult = await kv.get(["manga_chapters", slug]);
		const chapterRefs = (chaptersResult.value as ChapterReference[]) || [];
		
		// Reconstruct manga object
		const manga: Manga = {
			...details,
			chapters: chapterRefs.map(ref => ({
				number: ref.number,
				title: ref.title,
				url: ref.url,
				date: ref.date,
				pages: [] // Pages loaded separately when needed
			}))
		};
		
		return manga;
	} catch (error) {
		console.error(`Error getting manga ${slug}:`, error);
		return null;
	} finally {
		kv.close();
	}
}

// Helper function to get chapter content by manga slug and chapter number
export async function getChapterContent(mangaSlug: string, chapterNumber: string): Promise<ChapterContent | null> {
	const kv = await openKv();
	
	try {
		const result = await kv.get(["chapter_content", mangaSlug, chapterNumber]);
		return result.value as ChapterContent | null;
	} catch (error) {
		console.error(`Error getting chapter content ${mangaSlug}/${chapterNumber}:`, error);
		return null;
	} finally {
		kv.close();
	}
}

// Helper function to store individual chapter content
export async function storeChapterContent(mangaSlug: string, chapter: ChapterContent) {
	const kv = await openKv();
	
	try {
		const chapterContent: ChapterContent = {
			mangaSlug,
			number: String(chapter.number),
			title: chapter.title,
			url: chapter.url,
			date: chapter.date,
			pages: chapter.pages || []
		};
		
		await kv.set(["chapter_content", mangaSlug, String(chapter.number)], chapterContent);
		console.log(`Stored chapter content: ${mangaSlug} Chapter ${chapter.number}`);
	} catch (error) {
		console.error(`Error storing chapter content ${mangaSlug}/${chapter.number}:`, error);
		throw error;
	} finally {
		kv.close();
	}
}

// Helper function to get all manga slugs
export async function getAllMangaSlugs(): Promise<string[]> {
	const kv = await openKv();
	
	try {
		// Try new structure first
		const indexResult = await kv.get(["manga_index"]);
		if (indexResult.value) {
			return indexResult.value as string[];
		}
		
		// Fallback to old structure
		const slugs: string[] = [];
		const iter = kv.list({ prefix: ["manga"] });
		
		for await (const entry of iter) {
			const key = entry.key as string[];
			if (key.length === 2 && key[0] === "manga") {
				slugs.push(key[1]);
			}
		}
		
		return slugs;
	} finally {
		kv.close();
	}
}

// Helper function to get the last update timestamp
export async function getLastUpdateDate(): Promise<string | null> {
	const kv = await openKv();
	const result = await kv.get(["config", "lastUpdate"]);
	kv.close();
	return result.value as string | null;
}

// Helper function to set the last update timestamp
export async function setLastUpdateDate(date: string) {
	const kv = await openKv();
	await kv.set(["config", "lastUpdate"], date);
	kv.close();
}
