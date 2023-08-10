import { HandlerContext } from "$fresh/server.ts";

// Jokes courtesy of https://punsandoneliners.com/randomness/programmer-jokes/

import { MongoClient } from "https://deno.land/x/mongo@v0.31.2/mod.ts";
import { Manga } from "../../utils/manga.ts";

const client = new MongoClient();

await client.connect(Deno.env.get("MONGO_URI") ?? "");

const db = client.database("asura");

const dbManga = db.collection("manga");

export const handler = async (_req: Request, _ctx: HandlerContext): Promise<Response> => {
	const mangaList = (await dbManga.find({}).toArray()) as Manga[];

	const searchParams = new URL(_req.url).searchParams;

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

	const Query: any = {};

	if (search) {
		if (!Query.$and) {
			Query.$and = [];
		}
		Query.$and.push({
			$search: {
				index: "default",
				text: {
					query: search,
					path: {
						wildcard: "*",
					},
				},
			},
		});
	}
	if (genreSplit && genreSplit.length > 0 && genreSplit[0] != "") {
		if (!Query.$and) {
			Query.$and = [];
		}
		Query.$and.push({ genres: { $in: genreSplit } });
	}

	const count = await dbManga.countDocuments(Query);

	let sdata = (await dbManga
		.find(Query)
		.sort({
			Updated_On: -1,
		})
		.skip(start)
		.limit(limit)
		.toArray()) as Manga[];

	const r = {
		data: sdata.map((manga: Manga) => {
			manga.chapters.map((chapter) => {
				chapter.pages = "https://asura.aiko-sus.xyz/api/" + manga.slug + "/chapter/" + chapter.number;
				return chapter;
			});
			return manga;
		}),
		total: count,
		page: page,
		pagesLeft: Math.ceil(count / limit) - page,
		limit: limit ?? "10",
	};

	return new Response(JSON.stringify(r));
};
