import AsuraParser from "./sites/asura.ts";


async function fetchMangaList(){
	const parser = new AsuraParser();
	for await (const manga of parser.getMangaList()) {
		manga.parseChapters();
	}
}

fetchMangaList();