import { HandlerContext } from "$fresh/server.ts";

// Jokes courtesy of https://punsandoneliners.com/randomness/programmer-jokes/
import { MongoClient, ObjectId } from "https://deno.land/x/mongo@v0.31.0/mod.ts";
import { Manga } from "../../../../../utils/manga.ts";

const client = new MongoClient();

await client.connect(Deno.env.get("MONGO_URI") as string);

const db = client.database("asura");

const dbManga = db.collection("manga");

const dbChapters = db.collection("chapters");

export const handler = async (_req: Request, _ctx: HandlerContext): Promise<Response> => {
	const slug = _ctx.params.slug;
	const chapter = Number(_ctx.params.chapter);
	// check if slug & chapter is empty
	if (!slug || !chapter) {
		return new Response("Manga not found", { status: 404 });
	}

	const manga = (await dbManga.findOne({
		slug,
	})) as Manga;

	// check if manga is empty
	if (!manga) {
		return new Response("Manga not found", { status: 404 });
	}

	const chapters = manga.chapters;
	let res = null;

	if (isNaN(chapter)) {
		// check if we can find the chapter by id instead
		const C_chapter = await dbChapters.findOne({
			_id: new ObjectId(_ctx.params.chapter),
		});

		if (!C_chapter) return new Response("Chapter not found", { status: 404 });
	}

	res =
		res ??
		(await dbChapters.findOne(
			{
				mangaId: manga._id,
				number: chapter,
			},
			{
				sort: {
					number: 1,
				},
			},
		));

	if (chapter > chapters.length || chapter < 0 || !res) {
		return new Response("Chapter not found", { status: 404 });
	}

	return new Response(JSON.stringify(res));
};
