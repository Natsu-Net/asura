import type { Chapter, Manga } from "./manga.ts";
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

export async function ServerFetcher(url: string) {

	const MongoClient = (await import("https://deno.land/x/mongo@v0.31.2/mod.ts")).MongoClient;

	const client = new MongoClient();

	await client.connect(Deno.env.get("MONGO_URI") ?? "");

	const db = client.database("asura");

	const dbManga = db.collection("manga");

	const dbChapters = db.collection("chapters");

	const searchParams = new URL(url).searchParams;

	const page = parseInt(searchParams.get("page") ?? "1");
	const search = searchParams.get("search") ?? "";
	const genres = searchParams.get("genres") ?? "";

	const genreSplit = genres?.split(",");

	let limit = parseInt(searchParams.get("limit") ?? "10");

	if (isNaN(page) || isNaN(limit)) {
		return new Response("Invalid page or limit", { status: 400 });
	}

	if (limit > 25) {
		limit = 25;
	}

	const start = page - 1 < 0 ? 0 : page == 1 ? 0 : (page - 1) * limit;

	// deno-lint-ignore no-explicit-any
	const Query:any = {
	}
	
	if (search) {
		if (!Query.$and) {
			Query.$and = [];
		}
		Query.$and.push({ title: { $regex: search, $options: "i" } });
	}
	if (genreSplit && genreSplit.length > 0 && genreSplit[0] != "") {
		if (!Query.$and) {
			Query.$and = [];
		}
		Query.$and.push({ genres: { $in: genreSplit } });
	}

	const count = await dbManga.countDocuments(Query);

	const sdata = (await dbManga.find(Query).sort({
		Updated_On: -1,
	}).skip(start).limit(limit).toArray()) as Manga[];



	const r = {
		data: sdata.map((manga: Manga) => {
			manga.chapters.map((chapter) => {
				chapter.pages = Deno.env.get("APP_URL") + "/api/" + manga.slug + "/chapter/" + chapter.number;
				return chapter;
			});
			return manga;
		}),
		total: count,
		page: page,
		pagesLeft: Math.ceil(count / limit) - page,
		limit: limit ?? "10",
	};


	return r as MangaData;
}

export async function ClientFetcher(url: string) {
	return await fetch(url).then((res) => res.json());
}
