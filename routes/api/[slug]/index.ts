import { HandlerContext } from "$fresh/server.ts";

// Jokes courtesy of https://punsandoneliners.com/randomness/programmer-jokes/

import { MongoClient } from "https://deno.land/x/mongo@v0.31.0/mod.ts";
import { Manga } from "../../../utils/manga.ts";

const client = new MongoClient();

await client.connect(Deno.env.get("MONGO_URI") as string);

const db = client.database("asura");

const dbManga = db.collection("manga");

const dbChapters = db.collection("chapters");

export const handler = async (_req: Request, _ctx: HandlerContext): Promise<Response> => {
	const startTime = Date.now();
	const slug = _ctx.params.slug;
	const searchParams = new URL(_req.url).searchParams;
	const includeChapters = searchParams.get("includeChapters") === "true" ? true : false;
	const manga = await dbManga.findOne({ slug: slug }) as Manga;

	// get all chapters

	// check if manga is empty
	if (!manga || !slug) {
		return new Response("Manga not found", { status: 404 });
	}

	if (manga) {
		if (!includeChapters) {
			console.log(`Took ${Date.now() - startTime}ms to fetch ${manga.slug}`);
			return new Response(JSON.stringify(manga));
		}

		const chapters = await dbChapters
			.find({
				$or : [
					{
						_id: {
							$in: manga.chapters.map((chapter) => chapter._id),
						}
					},
					{
						mangaId: manga._id,
					}
				]
			})
			.sort({
				number: -1,
			})
			.toArray();
		console.log(`Took ${Date.now() - startTime}ms to fetch ${manga.slug} with chapters`);

		return new Response(
			JSON.stringify({
				...manga,
				chapters: chapters.sort((a, b) => b.chapter - a.chapter),
			}),
		);
	} else {
		return new Response("Manga not found", { status: 404 });
	}
};
