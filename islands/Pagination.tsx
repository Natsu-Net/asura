// "total":181,"page":0,"pagesLeft":19,"limit":10

import { Signal } from "@preact/signals";
import { ClientFetcher } from "../utils/fetcher.ts";
import { Manga } from "../utils/manga.ts";

interface PaginationData {
	total: number;
	page: number;
	pagesLeft: number;
	limit: number;
	size: number;
}

const PAGES_SIZE = 18;

export default function Pagination({ PaginationData,currentPage,MangaListData }: { PaginationData: Signal<PaginationData>,currentPage : Signal<number>,MangaListData : Signal<Manga[]> }) {
	const pages = [];
	
	// calculate the pages left

	// get 3 pages before and after the current page and make sure they are not negative or more than the page left


	let startPage = PaginationData.value.page - 3;
	let endPage = PaginationData.value.page + 3;
	const TotalPages = PaginationData.value.page + PaginationData.value.pagesLeft;

	if (startPage < 1) {
		endPage += Math.abs(startPage) + 1;
		startPage = 1;
	}

	if (endPage > TotalPages) {
		endPage = TotalPages;
	}

	if (startPage > 1) {
		pages.push(
			-1
		);
	}

	if (PaginationData.value.page == 0) PaginationData.value.page = 1;
	
	for (let i = startPage; i <= endPage; i++) {
		pages.push(
			i
		);
	}

	if (PaginationData.value.pagesLeft > 3) {
		pages.push(
			-2
		);
	}

	const changePage = async (page: number) => {
	
		// change page
		// get current url
		const url = new URL(window.location.href);
		if (page === -1) {
			page = startPage - 1;
		} else if (page === -2) {
			page = endPage + 1;
		}

		// change page param
		url.searchParams.set("page", page.toString());
		// push new url
		window.history.pushState({}, "", url.toString());

		currentPage.value = page;
		const tempPages = [];
		// add 18 loading cards
		for (let i = 0; i < PAGES_SIZE; i++) {
			tempPages.push(
				{
					"slug": "",
					"title": "Loading...",
					"imgUrl": "/loading.gif",
					"Updated_On": "",
					"Genres": [],
					"Author": "",
					"Artist": "",
					"Description": "",
					"Status": "",
					"Views": 0,
					"Rating": 0,
					"Chapters": [],
				}
			);
		}
		MangaListData.value = tempPages as unknown as Manga[];
		const data = await ClientFetcher( "/api" + url.pathname + url.search + "&limit=" + PAGES_SIZE.toString());
		console.log(data);
		
		PaginationData.value = {
			total: data.total,
			page: data.page,
			pagesLeft: data.pagesLeft,
			limit: data.limit,
			size: PaginationData.value.size,
		};
		MangaListData.value = data.data;
		
		
	};

	return (
		<>
			<nav>
				<ul class="pagination justify-content-center">
					{pages.map((page) => {
						if (page === -1) {
							return (
								<li class="page-item">
									<a class="page-link" onClick={() => changePage(page)}>
										<span aria-hidden="true">&laquo;</span>
									</a>
								</li>
							);
						} else if (page === -2) {
							return (
								<li class="page-item">
									<a class="page-link" onClick={(e) => changePage(page)}>
										<span aria-hidden="true">&raquo;</span>
									</a>
								</li>
							);
						} else if (page == currentPage.value) {
							return (
								<li class="page-item active">
									<a class="page-link" onClick={() => changePage(page)}>
										{page}
									</a>
								</li>
							);
						} else {
							return (
								<li class="page-item">
									<a class="page-link" onClick={() => changePage(page)}>
										{page}
									</a>
								</li>
							);
						}

					})}
				</ul>
			</nav>
		</>
	);
}
