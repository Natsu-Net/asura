import { Head,asset } from "$fresh/runtime.ts";
import { useSignal } from "@preact/signals";
import MangaList from "../islands/MangaList.tsx";
import Pagination from "../islands/Pagination.tsx";
import MangaDetails from "../islands/MangaDetails.tsx";
import ChapterReader from "../islands/ChapterRead.tsx";
import { Handlers } from "$fresh/server.ts";
import { ServerFetcher, ClientFetcher } from "../utils/fetcher.ts";
import { IS_BROWSER } from "$fresh/runtime.ts";
import { type Manga, type Chapter, PaginationData, currentPage } from "../utils/manga.ts";


const formatDate = (sdate: string) => {
	const date = new Date(sdate);
	const hours = date.getHours() < 10 ? `0${date.getHours()}` : date.getHours();
	const minutes = date.getMinutes() < 10 ? `0${date.getMinutes()}` : date.getMinutes();
	const day = date.getDate() < 10 ? `0${date.getDate()}` : date.getDate();
	const month = date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1;
	const year = date.getFullYear();
	return `${hours}:${minutes} - ${day}/${month}/${year}`
	
}
const getCurrentTimeZoneUTC = () => {
	const date = new Date();
	const timeZone = date.getTimezoneOffset() / 60;
	if (timeZone < 0) {
		return `UTC${timeZone}`;
	} else if (timeZone === 0) {
		return `UTC`;
	} else {
		return `UTC+${timeZone}`;
	}
}

interface Genre {
	name: string;
	url: string;
}

interface MangaData {
	data: Manga[];
	total: number;
	page: number;
	pagesLeft: number;
	limit: number;
}

const PAGES_SIZE = 18;

export const handler: Handlers<MangaData | null> = {
	async GET(r, ctx) {
		const url = new URL(r.url);
		if (!url.searchParams.has("limit")) {
			url.searchParams.set("limit", PAGES_SIZE.toString());
		}

		if (!IS_BROWSER) {
			const data = await ServerFetcher(url.toString()) as MangaData;

			return ctx.render(data);
		} else {
			const data = await ClientFetcher(url.toString());

			return ctx.render(data);
		}
	},
};

export default function Home({ data }: { data: MangaData }) {
	const MangaListData = useSignal<Manga[]>([]);

	PaginationData.value = {
		total: data.total,
		page: data.page,
		pagesLeft: data.pagesLeft,
		limit: data.limit,
		size: PAGES_SIZE,
	};


	currentPage.value = data.page;

	const lastUpdate = data.data[0].Updated_On;

	MangaListData.value = data.data;

	return (
		<>
			<Head>
				<title>Asura.gg | Parser</title>
				<link href={asset("/styles/style.css")} rel="stylesheet" />
				<script src="https://kit.fontawesome.com/5a18604bbb.js" crossOrigin="anonymous"></script>
				{/* icon is logo.webp */}
				<link rel="icon" href={asset("/logo.webp")} />
			</Head>

			<div data-bs-theme="dark" style="margin:0;padding:0">
				<nav class="navbar bg-body-tertiary">
					<div class="container-md">
						{/* center text */}
						<a class="navbar-brand" href="/">
							{/* icon is logo.webp */}
							<img src={asset("/logo.webp")} alt="Asura Parser" width="42" height="42" class="d-inline-block mr-5" />
						</a>
						<form class="flex" role="search" method="get">
							<input class="form-control me-2" name="search" type="search" placeholder="Search" aria-label="Search" />
							<button class="btn btn-outline-success" type="submit">
								Search
							</button>
						</form>
					</div>
				</nav>
				<div class="container-fluid text-center">
					<div class="container-md">
						<div>
							<h1 class="mt-3">
								<a href="/readme.html" style="width: fit-content;">
									API Document
								</a>
							</h1>
							<p>Last updated: {formatDate(lastUpdate)} {getCurrentTimeZoneUTC()}. from asura.gg</p>
							<p>Totals : {data.total}</p>
							<div class="row">
								<MangaList Mangas={MangaListData} />
							</div>
							<div class="col-12 mt-5 fixed-bottom mb-20">
								<Pagination PaginationData={PaginationData} currentPage={currentPage} MangaListData={MangaListData} />
							</div>
						</div>
					</div>
				</div>
			</div>

			<MangaDetails />
			<ChapterReader />

		</>
	);
}
