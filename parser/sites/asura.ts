import { Chapter, Manga } from "../../utils/manga.ts";
import { DOMParser, HTMLDocument, Element } from "https://deno.land/x/deno_dom@v0.1.48/deno-dom-wasm.ts";

const BASE_URL = "https://asuracomic.net";

export default class AsuraParser {
	private result: Manga[] = [];

	public domain = BASE_URL;
	private dateList = [] as string[];

	public getSlugFromUrl(url: string) {
		const split = url.split("/").filter((s) => s !== "");
		let slug = split[split.length - 1];
		
		// Remove numeric prefixes (e.g., "123-title" -> "title")
		slug = slug.replace(/^[0-9]+-/, "");
		
		// Remove hash suffixes (e.g., "title-abc123def" -> "title")
		slug = slug.replace(/-[a-f0-9]{8,}$/i, "");
		
		// Clean up trailing dashes
		slug = slug.replace(/-+$/, "");

		return slug;
	}

	public getSlugFromTitle(title: string) {
		return title
			.replace(/[^a-zA-Z0-9]/g, "-")
			.replace(/-+/g, "-")
			.replace(/-+$/, "")
			.toLowerCase();
	}

	public async *getMangaList() {
		let currentPage = 1;
		let hasNextPage = true;

		const mangaLists: Manga[] = [];
		this.dateList = [];
		const processedUrls = new Set<string>();
		
		while (hasNextPage && currentPage <= 10) {
			const response = await fetch(`${this.domain}/series?page=${currentPage}`);
			const html = await response.text();
			const parser = new DOMParser().parseFromString(html, "text/html") as HTMLDocument;
			
			// Look for manga links in the grid - they use /series/ URLs
			const mangaLinks = parser.querySelectorAll('a[href^="/series/"]:not([href="/series?page=1"])');
			console.log(`Found ${mangaLinks.length} manga links on page ${currentPage}`);
			
			if (mangaLinks.length === 0) {
				console.log(`No manga found on page ${currentPage}`);
				break;
			}

			// Process each manga link
			const uniqueLinksThisPage = new Set<string>();
			for (let i = 0; i < mangaLinks.length; i++) {
				const link = mangaLinks[i] as Element;
				const href = link.getAttribute('href');
				
				if (!href || !href.includes('/series/') || href.includes('?')) {
					continue;
				}
				
				const fullUrl = `${this.domain}${href}`;
				if (processedUrls.has(fullUrl)) {
					continue;
				}
				
				uniqueLinksThisPage.add(href);
				processedUrls.add(fullUrl);
			}
			
			console.log(`Processing ${uniqueLinksThisPage.size} new manga from page ${currentPage}`);
			let processedCount = 0;

			for (const href of uniqueLinksThisPage) {
				try {
					// Extract slug from URL
					const mangaSlug = href.split('/series/')[1];
					if (!mangaSlug) {
						continue;
					}
					
					const url = `${this.domain}${href}`;
					// Use clean slug generation - prefer title-based slug over URL-based
					let slug = this.getSlugFromTitle(mangaSlug);
					
					// Only use URL-based slug if title-based fails
					if (!slug || slug.length < 3) {
						slug = this.getSlugFromUrl(url);
					}

					// check if the manga is already in the list
					const mangaData = mangaLists.find(
						(manga) =>
							manga.slug === slug ||
							manga.originalSlug === mangaSlug,
					);

					const details = (await this.getMangaDetails(url ?? "", slug)) as Manga;
					if (!details || !details.title || details.title === "EMPTY") {
						continue;
					}
					
					details.slug = slug;
					details.originalSlug = mangaSlug;
					details.url = url;
					processedCount++;

					// check if the manga is already in the list and update it
					if (mangaData) {
						Object.assign(mangaData, details);
					} else {
						mangaLists.push(details);
					}

					yield {
						...details,
						parseChapters: async () => {
							// loop through all chapters && get the pages
							for (const chapter of details.chapters) {
								const pages = await this.getChapter(chapter.url ?? "");
								chapter.pages = pages;
							}

							return details;
						},
					} as Manga;
				} catch (error) {
					console.error(`Error processing manga ${href}:`, error);
				}
			}

			// Always continue to next page until we reach the limit or no links found
			// Don't stop just because we processed existing manga
			console.log(`Processed ${processedCount} manga from page ${currentPage}`);
			
			currentPage++;
			if (currentPage > 10) {
				hasNextPage = false;
			}
		}
	}

	public async getMangaDetails(url: string, slug: string): Promise<Manga> {
		const response = await fetch(url);
		const html = await response.text();
		const parser = new DOMParser().parseFromString(html, "text/html") as HTMLDocument;

		// deno-lint-ignore no-explicit-any
		let details: any = {};

		// Extract title from multiple possible sources (working logic from simple parser)
		const title = parser.querySelector('span.text-xl.font-bold')?.textContent?.trim() ||
					parser.querySelector('h3.hover\\:text-themecolor')?.textContent?.trim() ||
					parser.querySelector('title')?.textContent?.replace(' - Asura Scans', '')?.trim() ||
					parser.querySelector('meta[property="og:title"]')?.getAttribute('content')?.replace(' - Asura Scans', '')?.trim() ||
					"EMPTY";

		if (title === "EMPTY") {
			console.log(`Could not extract title from ${url}`);
			return {} as Manga;
		}

		// Extract image URL from multiple sources (working logic)
		const imgUrl = parser.querySelector('meta[property="og:image"]')?.getAttribute("content") ||
					   parser.querySelector('img[alt="poster"]')?.getAttribute("src") ||
					   parser.querySelector('img[alt*="poster"]')?.getAttribute("src") ||
					   "";

		// Try to extract other details from the page structure
		const parent = parser.querySelector("div.bixbox.animefull > div.bigcontent") || 
					   parser.querySelector("div") ||
					   parser;

		const genres =
			parent
				?.querySelector(".mgen")
				?.getElementsByTagName("a")
				.map((a) => a.textContent) ?? [];

		const sypnosis = parent?.querySelector(".entry-content")?.textContent?.trim() ||
						parser.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim() ||
						"";

		const ss = {} as Record<string, string>;

		for (const s of parent?.getElementsByClassName("fmed") ?? []) {
			const nameElement = s.getElementsByTagName("b")[0];
			const valueElement = s.getElementsByTagName("span")[0];
			if (nameElement && valueElement) {
				const name = nameElement.textContent;
				// remove all whitespaces characters except for space
				const value = valueElement.textContent.replace(/[^\S ]/g, "");
				ss[name.replace(" ", "_")] = value;
			}
		}

		details = {
			title,
			genres,
			imgUrl,
			sypnosis,
			url: url,
			chapters: await this.getChapterList(url, slug),
		};

		const Posted_On = ss.Posted_On ? new Date(ss.Posted_On.replace(/,/g, "")) : new Date();
		const Updated_On = ss.Updated_On ? new Date(ss.Updated_On.replace(/,/g, "")) : new Date();

		// Validate dates and use current date as fallback
		const validPostedOn = isNaN(Posted_On.getTime()) ? new Date() : Posted_On;
		const validUpdatedOn = isNaN(Updated_On.getTime()) ? new Date() : Updated_On;

		// check if its today
		if (validUpdatedOn.toDateString() !== new Date().toDateString()) {
			validUpdatedOn.setHours(16);
			// check if Updated_On is in my dateList
			if (this.dateList.includes(validUpdatedOn.toISOString())) {
				// if it is, remove 1 hour from it for every time it is in the list
				const timeFond = this.dateList.filter((d) => d === validUpdatedOn.toISOString()).length;
				this.dateList.push(validUpdatedOn.toISOString());
				validUpdatedOn.setTime(validUpdatedOn.getTime() - timeFond * 60 * 60 * 1000);
			} else {
				// if it isn't, add it to the list
				this.dateList.push(validUpdatedOn.toISOString());
			}
		}

		details.Updated_On = validUpdatedOn;
		details.Posted_On = validPostedOn;
		details.Posted_By = ss.Posted_By?.replace(/,/g, "") ?? "-";
		details.Author = ss.Author?.replace(/,/g, "") ?? "-";
		details.Artist = ss.Artist?.replace(/,/g, "") ?? "-";
		details.Rating = parent?.querySelector(".rating > .rating-prc > .num")?.textContent ?? 0;
		details.Followers = parseInt(parent?.querySelector(".rt > .bmc")?.textContent?.replace(/Followed by (.*?) people/gm, "$1") ?? "0");
		details.Released = ss.Released?.replace(/,/g, "") ?? "";
		details.Serialization = ss.Serialization?.replace(/,/g, "") ?? "";
		details.Status = parent?.querySelector(".tsinfo > .imptdt > i")?.textContent ?? "";

		return details;
	}

	public async getChapterList(url: string, _slug: string): Promise<Chapter[]> {
		const response = await fetch(url);
		const html = await response.text();

		const parser = new DOMParser().parseFromString(html, "text/html") as HTMLDocument;

		// Use Next.js compatible chapter detection
		const chapterLinks = parser.querySelectorAll('a[href*="/chapter/"]:not([href*="?"])');
		const chapters = [];

		for (const link of chapterLinks) {
			const url = link.getAttribute("href");
			const rawTitle = link.textContent?.trim() || "";
			
			// Extract chapter number from URL or title
			const urlMatch = url?.match(/\/chapter\/([0-9]+(?:\.[0-9]+)?)/);
			const titleMatch = rawTitle.match(/chapter[^0-9]*([0-9]+(?:\.[0-9]+)?)/i);
			const number = urlMatch?.[1] || titleMatch?.[1] || "";

			// Clean up the title - remove extra text and normalize
			let title = rawTitle;
			
			// Remove common prefixes/suffixes that cause duplicates
			title = title.replace(/^(New Chapter|Latest Chapter)\s*/i, '');
			title = title.replace(/\s*(January|February|March|April|May|June|July|August|September|October|November|December)[^0-9]*[0-9]{1,2}(st|nd|rd|th)?\s*[0-9]{4}\s*$/i, '');
			title = title.replace(/\s*[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4}\s*$/, ''); // Remove MM/DD/YYYY dates
			title = title.replace(/\s*[0-9]{4}-[0-9]{2}-[0-9]{2}\s*$/, ''); // Remove YYYY-MM-DD dates
			
			// If we have a chapter number, normalize the title format
			if (number) {
				// Check if title already has proper chapter format
				if (!title.match(/^Chapter\s+[0-9]+/i)) {
					title = `Chapter ${number}`;
				}
				// Clean up any double "Chapter" text
				title = title.replace(/Chapter\s+Chapter\s+/gi, 'Chapter ');
			}
			
			title = title.trim();

			// Try to extract date from surrounding elements
			const parentElement = link.closest('li') || link.parentElement;
			const dateElement = parentElement?.querySelector('[class*="date"]') || 
							   parentElement?.querySelector('time') ||
							   parentElement?.querySelector('[datetime]');
			const date = dateElement?.textContent?.trim() || new Date().toISOString().split('T')[0];

			if (url && title && number) {
				// Ensure the URL includes /series/ prefix for correct format
				let fullUrl = url;
				if (url.startsWith('http')) {
					fullUrl = url;
				} else if (url.startsWith('/series/')) {
					fullUrl = `${this.domain}${url}`;
				} else if (url.startsWith('/')) {
					fullUrl = `${this.domain}/series${url}`;
				} else {
					fullUrl = `${this.domain}/series/${url}`;
				}
				
				chapters.push({
					title,
					url: fullUrl,
					date,
					number,
					pages: [],
				});
			}
		}
		
		return chapters.sort((a, b) => parseFloat(a.number ?? "0") - parseFloat(b.number ?? "0")) as unknown as Chapter[];
	}

	public async getChapter(url: string): Promise<string[]> {
		const response = await fetch(url);
		const html = await response.text();

		// Extract all image URLs from the HTML content using regex
		const imagePattern = /https:\/\/gg\.asuracomic\.net\/storage\/media\/\d+\/conversions\/[^'\"\\s]+\.webp/g;
		const allImages = html.match(imagePattern) || [];

		// Remove duplicates first
		const uniqueImages = [...new Set(allImages)];
		
		// Filter out common UI images (very low media IDs, usually < 50)
		const chapterImages = uniqueImages.filter(imageUrl => {
			const mediaIdMatch = imageUrl.match(/media\/(\d+)\//);
			if (!mediaIdMatch) return false;
			
			const mediaId = parseInt(mediaIdMatch[1]);
			// Keep images with media ID > 50 to filter out logo and UI elements
			return mediaId > 50;
		});
		
		// Sort by the numeric part in the filename (01, 02, 03, etc.)
		chapterImages.sort((a, b) => {
			const aMatch = a.match(/\/([a-f0-9]+)-optimized\.webp$/);
			const bMatch = b.match(/\/([a-f0-9]+)-optimized\.webp$/);
			if (aMatch && bMatch) {
				// If they're hex strings, compare as strings
				return aMatch[1].localeCompare(bMatch[1]);
			}
			return a.localeCompare(b);
		});

		return chapterImages;
	}
}
