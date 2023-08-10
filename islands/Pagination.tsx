// "total":181,"page":0,"pagesLeft":19,"limit":10

import { Signal } from "@preact/signals";

interface PaginationData {
	total: number;
	page: number;
	pagesLeft: number;
	limit: number;
	size: number;
}

export default function Pagination({ PaginationData,currentPage }: { PaginationData: Signal<PaginationData>,currentPage : Signal<number> }) {
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

	const changePage = (page: number) => {
	
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
		window.location.href = url.toString();

		currentPage.value = page;

		
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
									<a class="page-link" onClick={() => changePage(page)}>
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
