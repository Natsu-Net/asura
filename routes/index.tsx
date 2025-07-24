import { Head, asset } from "$fresh/runtime.ts";
import { useSignal } from "@preact/signals";
import MangaList from "../islands/MangaList.tsx";
import Pagination from "../islands/Pagination.tsx";
import MangaDetails from "../islands/MangaDetails.tsx";
import ChapterReader from "../islands/ChapterRead.tsx";
import SearchBar from "../islands/SearchBar.tsx";
import { Handlers } from "$fresh/server.ts";
import { IS_BROWSER } from "$fresh/runtime.ts";
import { type Manga, PaginationData, currentPage } from "../utils/manga.ts";

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
			const { ServerFetcher } = await import("../utils/fetcher.ts");
			const r = await ServerFetcher(url.toString());
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

	const lastUpdate = data.data && data.data.length > 0 ? data.data[0].Updated_On : null;

	MangaListData.value = data.data;

	return (
		<>
			<Head>
				<title>Asura Manga | Modern Reader</title>
				<link rel="icon" href={asset("/logo.webp")} />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<meta name="description" content="Modern manga reader with beautiful design and seamless experience" />
			</Head>

			<div class="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900">
				{/* Modern Navigation */}
				<nav class="fixed top-0 left-0 right-0 z-40 bg-black bg-opacity-20 backdrop-blur-md border-b border-white border-opacity-10">
					<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
						<div class="flex items-center justify-between h-16">
							<div class="flex items-center gap-3 flex-shrink-0">
								<img src={asset("/logo.webp")} alt="Asura" class="w-8 h-8 sm:w-10 sm:h-10 rounded-lg shadow-lg" />
								<div class="hidden sm:block">
									<h1 class="text-white text-lg sm:text-xl font-bold">Asura</h1>
									<span class="text-blue-300 text-xs sm:text-sm">Manga Reader</span>
								</div>
							</div>
							
							<SearchBar />
						</div>
					</div>
				</nav>

				{/* Hero Section */}
				<section class="pt-20 sm:pt-24 px-4 sm:px-6 lg:px-8">
					<div class="max-w-7xl mx-auto">
						<div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center py-8 sm:py-16">
							<div class="text-center lg:text-left">
								<h1 class="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-4 sm:mb-6 leading-tight">
									Discover Amazing
									<span class="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"> Manga</span>
								</h1>
								<p class="text-base sm:text-lg lg:text-xl text-gray-300 mb-6 sm:mb-8 leading-relaxed">
									Read the latest chapters from your favorite series with our modern, 
									fast, and beautiful manga reader interface.
								</p>
								<div class="flex flex-col sm:flex-row gap-4 sm:gap-6 mb-6 sm:mb-8 justify-center lg:justify-start">
									<div class="text-center">
										<span class="block text-2xl sm:text-3xl font-bold text-white">{data.total.toLocaleString()}</span>
										<span class="text-gray-400 text-sm sm:text-base">Total Manga</span>
									</div>
									<div class="hidden sm:block w-px bg-gray-600"></div>
									<div class="text-center">
										<span class="block text-lg sm:text-xl font-bold text-white">
											{lastUpdate ? formatDate(lastUpdate instanceof Date ? lastUpdate.toISOString() : lastUpdate.toString()) : 'No data'}
										</span>
										<span class="text-gray-400 text-sm sm:text-base">Last Updated {getCurrentTimeZoneUTC()}</span>
									</div>
								</div>
								<div class="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start">
									<a href="/api/docs/swagger" class="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-sm sm:text-base font-semibold hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
										<i class="fa-solid fa-book"></i>
										API Documentation
									</a>
									<a href="#manga-grid" class="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-white bg-opacity-10 text-white rounded-lg text-sm sm:text-base font-semibold border border-gray-600 hover:bg-opacity-20 transition-all duration-200">
										<i class="fa-solid fa-arrow-down"></i>
										Browse Library
									</a>
								</div>
							</div>
							<div class="relative hidden lg:block">
								<div class="relative z-10">
									{data.data.slice(0, 3).map((manga, index) => (
										<div class={`absolute w-32 h-44 sm:w-40 sm:h-56 lg:w-48 lg:h-64 rounded-xl overflow-hidden shadow-2xl transition-transform duration-1000 hover:scale-105 ${
											index === 0 ? '-top-32 left-16 z-30' : 
											index === 1 ? '-top-28 left-24 sm:-top-26 sm:left-28 lg:-top-24 lg:left-32 z-20' : 
											'-top-24 left-32 sm:-top-20 sm:left-40 lg:-top-16 lg:left-48 z-10'
										}`} style={{
											animation: `float ${3 + index}s ease-in-out infinite`,
											animationDelay: `${index * 0.5}s`
										}}>
											<img src={manga.imgUrl} alt={manga.title} class="w-full h-full object-cover" />
										</div>
									))}
								</div>
							</div>
						</div>
					</div>
				</section>				{/* Main Content */}
				<main class="px-4 sm:px-6 lg:px-8 pb-16">
					<div class="max-w-7xl mx-auto" id="manga-grid">
						<div class="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
							<h2 class="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
								<i class="fa-solid fa-fire text-orange-400"></i>
								Latest Updates
							</h2>
							<div class="px-3 sm:px-4 py-2 bg-white bg-opacity-10 rounded-lg text-white font-medium text-sm sm:text-base text-center sm:text-left">
								Page {data.page} of {Math.ceil(data.total / data.limit)}
							</div>
						</div>

						<div class="mb-8 sm:mb-12">
							<MangaList Mangas={MangaListData} />
						</div>

						<div class="flex justify-center">
							<Pagination PaginationData={PaginationData} currentPage={currentPage} MangaListData={MangaListData} />
						</div>
					</div>
				</main>

				{/* Modern Footer */}
				<footer class="bg-black bg-opacity-50 backdrop-blur-md border-t border-white border-opacity-10">
					<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
						<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-6 sm:mb-8">
							<div class="flex items-center gap-4 justify-center sm:justify-start">
								<img src={asset("/logo.webp")} alt="Asura" class="w-10 h-10 sm:w-12 sm:h-12 rounded-lg shadow-lg" />
								<div class="text-center sm:text-left">
									<h3 class="text-white text-lg sm:text-xl font-bold">Asura Manga</h3>
									<p class="text-gray-400 text-sm sm:text-base">Modern manga reading experience</p>
								</div>
							</div>
							
							<div class="text-center sm:text-left">
								<h4 class="text-white font-semibold mb-3 sm:mb-4">Resources</h4>
								<div class="space-y-2">
									<a href="/api/docs/swagger" class="block text-gray-400 hover:text-white transition-colors text-sm sm:text-base">API Documentation</a>
									<a href="/api/status" class="block text-gray-400 hover:text-white transition-colors text-sm sm:text-base">Service Status</a>
								</div>
							</div>
							<div class="text-center sm:text-left lg:col-span-1 sm:col-span-2 lg:col-span-1">
								<h4 class="text-white font-semibold mb-3 sm:mb-4">Technology</h4>
								<div class="space-y-2">
									<a href="https://deno.com" target="_blank" rel="noopener noreferrer" class="block text-gray-400 hover:text-white transition-colors text-sm sm:text-base">
										🦖 Powered by Deno
									</a>
									<a href="https://fresh.deno.dev" target="_blank" rel="noopener noreferrer" class="block text-gray-400 hover:text-white transition-colors text-sm sm:text-base">
										🍋 Built with Fresh
									</a>
								</div>
							</div>
						</div>
						
						<div class="pt-6 sm:pt-8 border-t border-gray-700 text-center">
							<p class="text-gray-400 text-sm sm:text-base">Made with ❤️ by Aiko • © 2024 Asura Manga Reader</p>
						</div>
					</div>
				</footer>
			</div>

			<MangaDetails />
			<ChapterReader />
		</>
	);
}
