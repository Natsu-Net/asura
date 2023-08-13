import { HandlerContext } from "$fresh/server.ts";

// Jokes courtesy of https://punsandoneliners.com/randomness/programmer-jokes/
import { MongoClient } from "https://deno.land/x/mongo@v0.31.2/mod.ts";

const client = new MongoClient();

await client.connect(Deno.env.get("MONGO_URI") ?? "");

const db = client.database("asura");

const dbManga = db.collection("manga");

const dbChapters = db.collection("chapters");

export const handler = async (_req: Request, _ctx: HandlerContext): Promise<Response> => {
	const slug = _ctx.params.slug;
	const chapter = Number(_ctx.params.chapter);
	const mangaList = (await dbManga.find({
		slug
	}).toArray())
	// check if manga is empty
	if (mangaList.length === 0 || !slug) {
		return new Response("Manga not found", { status: 404 });
	}
	const manga = mangaList[0]
	console.log(manga);
	if (manga) {
		const chapters = manga.chapters;
		if (isNaN(chapter)) {
			return new Response("Chapter not found", { status: 404 });
		}

		// check if theres a chapter 0 
		const c = chapters.find((c: { number: number; }) => Number(c.number) == chapter);
		const C_chapter = await dbChapters.findOne({
			mangaId: manga._id,
			_id: c._id
		})
		if (chapter > chapters.length || chapter < 0 || !c || !C_chapter) {
			return new Response("Chapter not found", { status: 404 });
		}
		

		return new Response(JSON.stringify(C_chapter));
	} else {
		return new Response("Manga not found", { status: 404 });
	}
};
