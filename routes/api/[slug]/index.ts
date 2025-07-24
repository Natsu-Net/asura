
import { FreshContext } from "$fresh/server.ts";
import { Manga } from "../../../utils/manga.ts";
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

	// If includeChapters is true, get chapters from KV
	if (includeChapters) {
		const kv = await Deno.openKv();
		const chapters = [];
		const iter = kv.list({ prefix: ["chapters", slug] });
		
		for await (const entry of iter) {
			chapters.push(entry.value);
		}
		
		// Sort chapters by number in descending order
		chapters.sort((a: any, b: any) => b.number - a.number);
		manga.chapters = chapters;
	}

	console.log(`Took ${Date.now() - startTime}ms to fetch ${manga.slug} with chapters`);

	return new Response(JSON.stringify(manga));
};
