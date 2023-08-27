import { Chapter, Manga } from "../../utils/manga.ts";
import { DOMParser, HTMLDocument } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const BASE_URL = "https://asura.nacm.xyz";

export default class AsuraParser {
	private result: Manga[] = [];

	public domain = BASE_URL;
	private dateList = [] as string[];

	public getSlugFromUrl(url: string) {
		const split = url.split("/").filter((s) => s !== "");
		const slug = split[split.length - 1].replace(/^[0-9]+-/, "").replace(/-+$/, "");

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
		let curentPage = 1;
		let hasNextPage = true;

		const mangaLists: Manga[] = [];
		this.dateList = [];
		while (hasNextPage) {
			const response = await fetch(`${this.domain}/manga/?page=${curentPage}&order=update`);
			const html = await response.text();
			const parser = new DOMParser().parseFromString(html, "text/html") as HTMLDocument;
			const content = parser.getElementById("content");

			const parent = content?.querySelector("#content > div > div.postbody > div > div.mrgn > div.listupd");
			const mangas = parent?.getElementsByTagName("a") ?? [];

			//console.log(mangas);

			for (const manga of mangas) {
				const title = manga.getAttribute("title");
				const url = manga.getAttribute("href");
				const chapterNum = manga.querySelector(".epxs")?.textContent.replace(/[^0-9]/g, "") ?? "";
				if (title === null || url === null) {
					continue;
				}

				let slug = this.getSlugFromTitle(title ?? "");
				if (this.getSlugFromUrl(url ?? "") !== slug) {
					slug = this.getSlugFromUrl(url ?? "");
				}

				// check if the manga is already in the list
				const mangaData = mangaLists.find(
					(manga) =>
						manga.slug === slug ||
						manga.originalSlug ===
							url
								.split("/")
								.filter((s) => s !== "")
								.pop(),
				);

				const details = (await this.getMangaDetails(url ?? "", slug)) as Manga;
				details.title = title;
				details.slug = slug;
				details.originalSlug =
					url
						.split("/")
						.filter((s) => s !== "")
						.pop() ?? slug;
				details.chapterNum = chapterNum;
				details.url = url;

				// check if the manga is already in the list and update it
				if (mangaData) {
					Object.assign(mangaData, details);
				} else {
					mangaLists.push(details);
				}

				yield {
					...details,
					parseChapters: async () => {
						// loop trough all chapters && get the pages
						for (const chapter of details.chapters) {
							const pages = await this.getChapter(chapter.url ?? "");
							chapter.pages = pages;
						}

						return details;
					},
				} as Manga;
			}

			// check if there is a next page
			const next = content?.querySelector("#content > div > div.postbody > div > div.mrgn > div.hpage > a.r");
			if (next?.textContent === "Next ") {
				curentPage++;
				hasNextPage = true;
			} else {
				hasNextPage = false;
			}
		}
	}

	public async getMangaDetails(url: string, slug: string): Promise<Manga> {
		const response = await fetch(url);
		const html = await response.text();
		const parser = new DOMParser().parseFromString(html, "text/html") as HTMLDocument;

		const parent = parser.querySelector("div.bixbox.animefull > div.bigcontent");

		// deno-lint-ignore no-explicit-any
		let details: any = {};

		const genres =
			parent
				?.querySelector(".mgen")
				?.getElementsByTagName("a")
				.map((a) => a.textContent) ?? [];
		const title = parent?.querySelector("div.bixbox.animefull > div.bigcontent > div.infox > h1")?.textContent ?? "";

		const imgUrl = parent?.getElementsByTagName("img")[0]?.getAttribute("src") ?? "";

		const sypnosis = parent?.querySelector(".entry-content")?.textContent ?? "";

		const ss = {} as Record<string, string>;

		for (const s of parent?.getElementsByClassName("fmed") ?? []) {
			const name = s.getElementsByTagName("b")[0].textContent;
			// remove all whitespaces characters exept for space
			const value = s.getElementsByTagName("span")[0].textContent.replace(/[^\S ]/g, "");

			ss[name.replace(" ", "_")] = value;
		}

		//remove all non alphanumeric characters except for dot & : //

		details = {
			title,
			genres,
			imgUrl,
			sypnosis,
			url: url,
			chapters: await this.getChapterList(url, slug),
		};

		const Posted_On =new Date(ss.Posted_On?.replace(/,/g, ""));
		let Updated_On = new Date(ss.Updated_On?.replace(/,/g, ""));
		// set the hour to 12
		Updated_On.setHours(16);
		// check if Updated_On is in my dateList
		if (this.dateList.includes(Updated_On.toISOString())) {
			// if it is, remove 1 hour from it for every time it is in the list
			const timeFond = this.dateList.filter((d) => d === Updated_On.toISOString()).length;
			this.dateList.push(Updated_On.toISOString());
			Updated_On.setTime(Updated_On.getTime() - (timeFond * 60 * 60 * 1000));
		} else {
			// if it isn't, add it to the list
			this.dateList.push(Updated_On.toISOString());
		}



		details.Updated_On = Updated_On;
		details.Posted_On = Posted_On;
		details.Posted_By = ss.Posted_By?.replace(/,/g, "") ?? "-";
		details.Author  = ss.Author?.replace(/,/g, "") ?? "-";
		details.Artist = ss.Artist?.replace(/,/g, "") ?? "-";
		details.Rating = parent?.querySelector(".rating > .rating-prc > .num")?.textContent ?? 0;
		details.Followers = parseInt(parent?.querySelector(".rt > .bmc")?.textContent.replace(/Followed by (.*?) people/gm,"$1") ?? "0");
		details.Released = ss.Released?.replace(/,/g, "") ?? "";
		details.Serialization = ss.Serialization?.replace(/,/g, "") ?? "";
		details.Status = parent?.querySelector(".tsinfo > .imptdt > i")?.textContent ?? "";


		return details;
	}

	public async getChapterList(url: string, _slug: string): Promise<Chapter[]> {
		const response = await fetch(url);
		const html = await response.text();

		const parser = new DOMParser().parseFromString(html, "text/html") as HTMLDocument;

		const parent = parser.querySelector("#chapterlist > ul");
		const list = parent?.getElementsByTagName("li") ?? [];

		const chapters = [];

		for (const chapter of list) {
			const url = chapter.querySelector("a")?.getAttribute("href");
			const title = chapter.querySelector("a")?.querySelector(".chapternum")?.textContent;
			const date = chapter.querySelector("a")?.querySelector(".chapterdate")?.textContent;
			// extract only the number from the data-num attribute at the start of the string :  93 - Heavenly Mountain’s Small Demon (1) -> 93, 93.3 - Heavenly Mountain’s Small Demon (1) -> 93.3
			const number = chapter.getAttribute("data-num")?.match(/^[0-9]+(\.[0-9]+)?/)?.[0] ?? "";

			chapters.push({
				title,
				url,
				date,
				number,
				pages: [],
			});
		}
		return chapters.sort((a, b) => parseInt(a.number ?? "0") - parseInt(b.number ?? "0")) as unknown as Chapter[];
	}

	public async getChapter(url: string): Promise<string[]> {
		const response = await fetch(url);
		const html = await response.text();

		const parser = new DOMParser().parseFromString(html, "text/html") as HTMLDocument;

		const parent = parser.querySelector("#readerarea");

		const pages = parent?.getElementsByTagName("img") ?? [];

		const images = [];

		for (const page of pages) {
			const url = page.getAttribute("src");
			// check if its its parent got class asurascans.rights
			if (page.parentElement?.classList.contains("asurascans.rights")) {
				continue;
			}

			if (url) {
				images.push(url);
			}
		}

		return images;
	}
}
