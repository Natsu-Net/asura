import { HandlerContext } from "$fresh/server.ts";
import { Manga } from "../../../../../utils/manga.ts";
import { getMangaBySlug } from "../../../../../utils/fetcher.ts";
import { getChapter } from "../../../../../build-database.ts";

export const handler = async (_req: Request, _ctx: HandlerContext): Promise<Response> => {
	const slug = _ctx.params.slug;
	const chapterParam = _ctx.params.chapter;
	
	// check if slug & chapter is empty
	if (!slug || !chapterParam) {
		return new Response("Manga not found", { status: 404 });
	}

	const manga = await getMangaBySlug(slug);
	
	// check if manga is empty
	if (!manga) {
		return new Response("Manga not found", { status: 404 });
	}

	// Get chapter from KV store
	const chapter = await getChapter(slug, chapterParam);

	if (!chapter) {
		return new Response("Chapter not found", { status: 404 });
	}

	return new Response(JSON.stringify(chapter));
};
