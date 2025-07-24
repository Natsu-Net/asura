import type { Manga } from "./manga.ts";

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

// Helper function to filter manga based on search and genres
function filterManga(manga: Manga, search: string, genreSplit: string[]): boolean {
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
	const kv = await Deno.openKv();
	
	const searchParams = new URL(url).searchParams;

	const page = parseInt(searchParams.get("page") ?? "1");
	const search = searchParams.get("search") ?? "";
	const genres = searchParams.get("genres") ?? "";

	const genreSplit = genres?.split(",").filter(g => g.trim() !== "");

	let limit = parseInt(searchParams.get("limit") ?? "10");

	if (isNaN(page) || isNaN(limit)) {
		return new Response("Invalid page or limit", { status: 400 });
	}

	if (limit > 25) {
		limit = 25;
	}

	const start = page - 1 < 0 ? 0 : page == 1 ? 0 : (page - 1) * limit;

	// Get all manga from KV store
	const allManga: Manga[] = [];
	const iter = kv.list({ prefix: ["manga"] });
	
	for await (const entry of iter) {
		const manga = entry.value as Manga;
		if (filterManga(manga, search, genreSplit)) {
			allManga.push(manga);
		}
	}

	// Sort by Updated_On date descending
	allManga.sort((a, b) => {
		const dateA = new Date(a.Updated_On || 0).getTime();
		const dateB = new Date(b.Updated_On || 0).getTime();
		return dateB - dateA;
	});

	const total = allManga.length;
	const sdata = allManga.slice(start, start + limit);

	const r = {
		data: sdata.map((manga: Manga) => {
			manga.chapters.map((chapter) => {
				chapter.pages = (Deno.env.get("APP_URL") || "") + "/api/" + manga.slug + "/chapter/" + chapter.number;
				return chapter;
			});
			return manga;
		}),
		total: total,
		page: page,
		pagesLeft: Math.ceil(total / limit) - page,
		limit: limit,
	};

	return r as MangaData;
}

// Helper function to store manga in KV
export async function storeManga(manga: Manga) {
	const kv = await Deno.openKv();
	await kv.set(["manga", manga.slug], manga);
}

// Helper function to get manga by slug
export async function getMangaBySlug(slug: string): Promise<Manga | null> {
	const kv = await Deno.openKv();
	const result = await kv.get(["manga", slug]);
	return result.value as Manga | null;
}

// Helper function to get all manga slugs
export async function getAllMangaSlugs(): Promise<string[]> {
	const kv = await Deno.openKv();
	const slugs: string[] = [];
	const iter = kv.list({ prefix: ["manga"] });
	
	for await (const entry of iter) {
		const key = entry.key as string[];
		if (key.length === 2 && key[0] === "manga") {
			slugs.push(key[1]);
		}
	}
	
	return slugs;
}
