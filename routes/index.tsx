import { Head, asset } from "$fresh/runtime.ts";
import { useSignal } from "@preact/signals";
import MangaList from "../islands/MangaList.tsx";
import Pagination from "../islands/Pagination.tsx";
import MangaDetails from "../islands/MangaDetails.tsx";
import ChapterReader from "../islands/ChapterRead.tsx";
import { Handlers } from "$fresh/server.ts";
import { IS_BROWSER } from "$fresh/runtime.ts";
import { type Manga, type Chapter, PaginationData, currentPage } from "../utils/manga.ts";

const formatDate = (sdate: string) => {
	const date = new Date(sdate);
	const hours = date.getHours() < 10 ? `0${date.getHours()}` : date.getHours();
	const minutes = date.getMinutes() < 10 ? `0${date.getMinutes()}` : date.getMinutes();
	const day = date.getDate() < 10 ? `0${date.getDate()}` : date.getDate();
	const month = date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1;
	const year = date.getFullYear();
	return `${hours}:${minutes} - ${day}/${month}/${year}`;
};
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
};

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
			const MongoClient = (await import("npm:mongodb")).MongoClient;
			const client = await new MongoClient(Deno.env.get("MONGO_URI") ?? "").connect();

			const db = client.db("asura");

			const dbManga = db.collection("manga");

			const searchParams = new URL(url).searchParams;

			const page = parseInt(searchParams.get("page") ?? "1");
			const search = searchParams.get("search") ?? "";
			const genres = searchParams.get("genres") ?? "";

			const genreSplit = genres?.split(",");

			let limit = parseInt(searchParams.get("limit") ?? "10");

			if (isNaN(page) || isNaN(limit)) {
				return new Response("Invalid page or limit", { status: 400 });
			}

			if (limit > 25) {
				limit = 25;
			}

			const start = page - 1 < 0 ? 0 : page == 1 ? 0 : (page - 1) * limit;

			// deno-lint-ignore no-explicit-any
			const Query: any = {};

			if (search) {
				if (!Query.$and) {
					Query.$and = [];
				}
				Query.$and.push({ title: { $regex: search, $options: "i" } });
			}
			if (genreSplit && genreSplit.length > 0 && genreSplit[0] != "") {
				if (!Query.$and) {
					Query.$and = [];
				}
				Query.$and.push({ genres: { $in: genreSplit } });
			}

			const count = await dbManga.countDocuments(Query);

			const sdata = (await dbManga
				.find(Query)
				.sort({
					Updated_On: -1,
				})
				.skip(start)
				.limit(limit)
				.toArray()) as unknown as Manga[];

			const r = {
				data: sdata.map((manga: Manga) => {
					manga.chapters.map((chapter) => {
						chapter.pages = Deno.env.get("APP_URL") + "/api/" + manga.slug + "/chapter/" + chapter.number;
						return chapter;
					});
					return manga;
				}),
				total: count,
				page: page,
				pagesLeft: Math.ceil(count / limit) - page,
				limit: limit ?? "10",
			};

			return ctx.render(r);
		} else {
			const data = await fetch(url).then((res) => res.json());

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
							<img src={asset("/logo.webp")} alt="Asura Parser" width="48" height="48" class="d-inline-block mr-5" />
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
							<p>
								Last updated: {formatDate(lastUpdate)} {getCurrentTimeZoneUTC()}. from asura.gg
							</p>
							<p>Totals : {data.total}</p>
							<div class="row">
								<MangaList Mangas={MangaListData} />
							</div>
							<div class="col-12 mt-5 bottom-absolute mb-20">
								<Pagination PaginationData={PaginationData} currentPage={currentPage} MangaListData={MangaListData} />
							</div>
						</div>
					</div>
				</div>
				<footer class="bg-body-tertiary text-center text-lg-start">
					<div class="text-center p-3 bg-body-tertiary">
						<span class="text-white">
							Made with ❤️ by Aiko <br />
							Powered by 
							<a href="https://deno.com" class="text-decoration-none">
								🦖
							</a>
						</span>
					</div>
				</footer>
			</div>

			<MangaDetails />
			<ChapterReader />
		</>
	);
}
