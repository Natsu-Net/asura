
/// <reference lib="deno.unstable" />

import { FreshContext } from "$fresh/server.ts";
import { Manga, Chapter } from "../../../utils/manga.ts";
import { getMangaBySlug } from "../../../utils/fetcher.ts";

export const handler = async (_req: Request, _ctx: FreshContext): Promise<Response> => {
	const startTime = Date.now();
	const slug = _ctx.params.slug;
	const searchParams = new URL(_req.url).searchParams;
	const includeChapters = searchParams.get("includeChapters") === "true";

	// check if slug is empty
	if (!slug) return new Response("Manga not found", { status: 404 });

	const manga = await getMangaBySlug(slug);

	// check if manga is empty
	if (!manga) {
		return new Response("Manga not found", { status: 404 });
	}

	// If includeChapters is true, chapters are already in the manga object
	if (includeChapters) {
		// Chapters are already stored in the manga object, just ensure they're sorted
		if (manga.chapters && Array.isArray(manga.chapters)) {
			manga.chapters.sort((a: Chapter, b: Chapter) => {
				const aNum = typeof a.number === 'string' ? parseFloat(a.number) : a.number;
				const bNum = typeof b.number === 'string' ? parseFloat(b.number) : b.number;
				return bNum - aNum;
			});
		}
	}

	console.log(`Took ${Date.now() - startTime}ms to fetch ${manga.slug} with chapters`);

	return new Response(JSON.stringify(manga));
};
