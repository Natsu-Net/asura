import { HandlerContext } from "$fresh/server.ts";

// Jokes courtesy of https://punsandoneliners.com/randomness/programmer-jokes/


import { MongoClient } from "https://deno.land/x/mongo@v0.31.2/mod.ts";
import { Manga } from "../../../utils/manga.ts";

const client = new MongoClient();

await client.connect(Deno.env.get("MONGO_URI") ?? "");

const db = client.database("asura");

const dbManga = db.collection("manga");

const dbChapters = db.collection("chapters");

export const handler = async (_req: Request, _ctx: HandlerContext): Promise<Response> => {
	const slug = _ctx.params.slug;
	const mangaList = (await dbManga.find({
		slug
	}).toArray()) as Manga[];

	// get all chapters
	
	// check if manga is empty
	if (mangaList.length === 0 || !slug) {
		return new Response("Manga not found", { status: 404 });
	}
	
	const manga = mangaList.find((manga) => manga.slug == slug || manga.originalSlug === slug);

	

	if (manga) {
		const chapters = await dbChapters.find({
			mangaId: (manga as any)._id 
		}).toArray();
		return new Response(JSON.stringify({
			...manga,
			chapters
		}));
	} else {
		return new Response("Manga not found", { status: 404 });
	}
};
