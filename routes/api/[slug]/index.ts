
import { FreshContext } from "$fresh/server.ts";
import { Manga } from "../../../utils/manga.ts";

import { MongoClient } from "npm:mongodb";
const client = await (new MongoClient(Deno.env.get("MONGO_URI") ?? "")).connect();

const db = client.db("asura");

const dbManga = db.collection("manga");

export const handler = async (_req: Request, _ctx: FreshContext): Promise<Response> => {
	const startTime = Date.now();
	const slug = _ctx.params.slug;
	const searchParams = new URL(_req.url).searchParams;
	const includeChapters = searchParams.get("includeChapters") === "true" ? true : false;

	// check if slug is empty
	if (!slug) return new Response("Manga not found", { status: 404 });

	const query: any = [
		{
			$match: {
				slug,
			},
		},
	];

	if (includeChapters)
		query.push({
			$lookup: {
				from: "chapters",
				localField: "_id",
				foreignField: "mangaId",
				as: "chapters",
				pipeline: [
					{
						$sort: {
							number: -1,
						},
					},
				],
			},
		});
	const result = dbManga.aggregate(query);

	const manga = (await result.toArray() as Manga[])?.[0];

	// check if manga is empty
	if (!manga || !slug) {
		return new Response("Manga not found", { status: 404 });
	}

	console.log(`Took ${Date.now() - startTime}ms to fetch ${manga.slug} with chapters`);

	return new Response(JSON.stringify(manga));
};
