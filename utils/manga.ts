import { signal } from "@preact/signals";
import { IS_BROWSER } from "$fresh/runtime.ts";

interface Manga {
	[x: string]: unknown;
	_id: string;
	Artist: string;
	title: string;
	slug: string;
	url: string;
	originalSlug: string;
	chapterNum: string;
	genres: string[];

	sypnosis: string;
	imgUrl: string;

	chapters: Chapter[];
	// deno-lint-ignore no-explicit-any
	parseChapters: () => Promise<any>;

	Updated_On: string;
	Posted_On: string;
	Posted_By: string;

	Author: string;
	Released: string;
	Serialization: string;
	Status: string;

	Type: string;
	Rating: number;
	Followers: number;
}

interface Chapter {
	_id?: string;
	images: string;
	title: string;
	url: string;
	date: string;
	number: number;
	pages: string[] | string;
}

export const showMangaDetails = signal<Manga | null>(null);
export const showChapterRead = signal<Chapter | null>(null);
export const readChapterList = signal<{
	[key: string]: {
		[key: string]: boolean;
	};
}>(JSON.parse(IS_BROWSER ? localStorage.getItem("readChapterList") ?? "{}" : "{}"));

export const currentPage = signal<number>(0);
export const PaginationData = signal<{
	page: number;
	pagesLeft: number;
	total: number;
	limit: number;
	size: number;
}>({
	page: 0,
	pagesLeft: 0,
	total: 0,
	limit: 0,
	size: 0,
});

readChapterList.subscribe((data) => {
	// write to localstorage
	IS_BROWSER && localStorage.setItem("readChapterList", JSON.stringify(data));
});
export type { Manga, Chapter };
