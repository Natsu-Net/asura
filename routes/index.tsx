import { Head } from "$fresh/runtime.ts";
import { signal, useSignal } from "@preact/signals";
import MangaList from "../islands/MangaList.tsx";
import Pagination from "../islands/Pagination.tsx";
import MangaDetails from "../islands/MangaDetails.tsx";
import ChapterReader from "../islands/ChapterRead.tsx";
import { Handlers } from "$fresh/server.ts";
import { ServerFetcher, ClientFetcher } from "../utils/fetcher.ts";
import { IS_BROWSER } from "$fresh/runtime.ts";
import { type Manga, type Chapter, MangaListData, PaginationData, currentPage } from "../utils/manga.ts";
import { useState } from "preact/hooks";


const formatDate = (sdate: string) => {
	const date = new Date(sdate);
	const hours = date.getHours() < 10 ? `0${date.getHours()}` : date.getHours();
	const minutes = date.getMinutes() < 10 ? `0${date.getMinutes()}` : date.getMinutes();
	const day = date.getDate() < 10 ? `0${date.getDate()}` : date.getDate();
	const month = date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1;
	const year = date.getFullYear();
	return `${hours}:${minutes} - ${day}/${month}/${year}`;;
	
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

			MangaListData.value = data.data;
			return ctx.render(data);
		} else {
			const data = await ClientFetcher(url.toString());

			MangaListData.value = data.data;
			return ctx.render(data);
		}
	},
};

export default function Home({ data }: { data: MangaData }) {
	PaginationData.value = {
		total: data.total,
		page: data.page,
		pagesLeft: data.pagesLeft,
		limit: data.limit,
		size: PAGES_SIZE,
	};


	currentPage.value = data.page;

	const lastUpdate = data.data[0].Updated_On;


	return (
		<>
			<Head>
				<title>Asura.gg | Parser</title>
				<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-9ndCyUaIbzAi2FUVXJi0CjmCapSmO7SnpJef0486qhLnuZ2cdeRhO02iuK6FUUVM" crossOrigin="anonymous" />
				<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" integrity="sha512-iecdLmaskl7CVkqkXNQ/ZH/XLlvWZOJyj7Yy7tcenmpD1ypASozpmT/E0iPtmFIB46ZmdtAc9eNBvH0H/ZpiBw==" crossOrigin="anonymous" referrerpolicy="no-referrer" />
				<link href="/style.css" rel="stylesheet" />
			</Head>

			<div data-bs-theme="dark" style="margin:0;padding:0">
				<nav class="navbar bg-body-tertiary">
					<div class="container-md">
						<a class="navbar-brand" href="/">
							Asura Parser
						</a>
						<form class="d-flex" role="search" method="get">
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
							<div class="row ">
								<MangaList Mangas={MangaListData.value} />
							</div>
							<div class="col-12 mt-5">
								<Pagination PaginationData={PaginationData} currentPage={currentPage} />
							</div>
						</div>
					</div>
				</div>
			</div>

			<MangaDetails />
			<ChapterReader />

			<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js" integrity="sha384-geWF76RCwLtnZ8qwWowPQNguL3RmwHVBC9FhGdlKrxdiJJigb/j/68SIy3Te4Bkz" crossOrigin="anonymous"></script>
		</>
	);
}
