import { HandlerContext } from "$fresh/server.ts";
import { Manga, Chapter } from "../../../../../utils/manga.ts";
import { getMangaBySlug, getChapterContent } from "../../../../../utils/fetcher.ts";
import AsuraParser from "../../../../../parser/sites/asura.ts";

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

	// Get chapter content from new KV structure
	let chapterContent = await getChapterContent(slug, chapterParam);

	// If chapter content doesn't exist, try to create it from manga chapters
	if (!chapterContent) {
		console.log(`Chapter content not found for ${chapterParam}, creating from manga chapters...`);
		
		// Get the chapter reference from manga chapters
		const manga = await getMangaBySlug(slug);
		if (!manga) {
			return new Response("Manga not found", { status: 404 });
		}

		const chapterRef = manga.chapters.find(ch => String(ch.number) === String(chapterParam));
		if (!chapterRef) {
			return new Response("Chapter not found", { status: 404 });
		}

		// Create chapter content from reference
		chapterContent = {
			mangaSlug: slug,
			number: String(chapterRef.number),
			title: chapterRef.title,
			url: chapterRef.url,
			date: chapterRef.date,
			pages: [] // Will be filled dynamically
		};
	}

	// If chapter has no pages or empty pages, try to fetch them dynamically
	if (!chapterContent.pages || chapterContent.pages.length === 0) {
		console.log(`Chapter ${chapterParam} has no pages, fetching dynamically...`);
		
		try {
			const parser = new AsuraParser();
			
			// Construct the correct chapter URL format
			const baseUrl = "https://asuracomic.net";
			const chapterUrl = `${baseUrl}/series/${slug}/chapter/${chapterParam}`;
			
			console.log(`Fetching pages from: ${chapterUrl}`);
			const pages = await parser.getChapter(chapterUrl);
			
			if (pages && pages.length > 0) {
				chapterContent.pages = pages;
				console.log(`Found ${pages.length} pages for chapter ${chapterParam}`);
			} else {
				console.log(`No pages found for chapter ${chapterParam}`);
			}
		} catch (error) {
			console.error(`Error fetching chapter pages:`, error);
		}
	}

	return new Response(JSON.stringify(chapterContent));
};
