import { HandlerContext } from "$fresh/server.ts";

// Jokes courtesy of https://punsandoneliners.com/randomness/programmer-jokes/
import { MongoClient, ObjectId } from "https://deno.land/x/mongo@v0.31.2/mod.ts";

const client = new MongoClient();

await client.connect(Deno.env.get("MONGO_URI") ?? "");

const db = client.database("asura");

const dbManga = db.collection("manga");

const dbChapters = db.collection("chapters");

export const handler = async (_req: Request, _ctx: HandlerContext): Promise<Response> => {
	const slug = _ctx.params.slug;
	const chapter = Number(_ctx.params.chapter);
	const mangaList = await dbManga
		.find({
			slug,
		})
		.toArray();
	// check if manga is empty
	if (mangaList.length === 0 || !slug) {
		return new Response("Manga not found", { status: 404 });
	}
	const manga = mangaList[0];
	//console.log(manga);
	if (manga) {
		const chapters = manga.chapters;
		if (isNaN(chapter)) {
			console.log(_ctx.params.chapter);
			// check if we can find the chapter by id instead
			const C_chapter = await dbChapters.findOne({
				_id: new ObjectId(_ctx.params.chapter),
			});
			console.log(C_chapter);
			if (C_chapter) return new Response(JSON.stringify(C_chapter));

			return new Response("Chapter not found", { status: 404 });
		}

		const C_chapter = await dbChapters.findOne({
			mangaId: manga._id,
			number: chapter,
		},{
			sort: {
				number: 1,
			}
		});
		if (chapter > chapters.length || chapter < 0 || !C_chapter) {
			return new Response("Chapter not found", { status: 404 });
		}

		return new Response(JSON.stringify(C_chapter));
	} else {
		return new Response("Manga not found", { status: 404 });
	}
};
