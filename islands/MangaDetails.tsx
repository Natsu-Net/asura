import { Signal, signal } from "@preact/signals";
import { showChapterRead, showMangaDetails,readChapterList } from "../utils/manga.ts";
import { IS_BROWSER } from "$fresh/runtime.ts";
import type { Manga,Chapter } from "../utils/manga.ts";

// format date as : 04:20 - 20/04/2021 make sur the month or day is not 1 digit or it will be 4:2- 2/4/2021 and that's not cool
const formatDate = (sdate: string) => {
	const date = new Date(sdate);
	const hours = date.getHours() < 10 ? `0${date.getHours()}` : date.getHours();
	const minutes = date.getMinutes() < 10 ? `0${date.getMinutes()}` : date.getMinutes();
	const day = date.getDate() < 10 ? `0${date.getDate()}` : date.getDate();
	const month = date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1;
	const year = date.getFullYear();
	return `${hours}:${minutes} - ${day}/${month}/${year}`;
	
}
// return current time zone as : UTC+2 or UTC-2
const getCurrentTimeZoneUTC = () => {
	const date = new Date();
	const timeZone = date.getTimezoneOffset() / 60;
	if (timeZone < 0) {
		return `UTC${timeZone}`;
	} else {
		return `UTC+${timeZone}`;
	}
}

export default function MangaDetails() {
	const r: Manga | null = showMangaDetails.value;

	showMangaDetails.value = r;

	let hide = false;

	const readChapter = (e: Event) => {
		if (!IS_BROWSER) return;
		let target = e.target as HTMLElement;
		let chap: Chapter | number = Number(target.getAttribute("data-chap") as string);
		if (!chap) {
			// check if the parent is the target
			target = target.parentElement as HTMLElement;
			chap = Number(target.getAttribute("data-chap") as string);
			if (!chap) {
				// check if the parent is the parent is the target
				target = target.parentElement as HTMLElement;
				chap = Number(target.getAttribute("data-chap") as string);
			}
		}
		chap = r?.chapters.find((c) => Number(c.number) === chap) as Chapter;

		showChapterRead.value = chap;
		if (!r?.slug) return "";
		if (!readChapterList.value[r.slug]) readChapterList.value[r.slug] = {};
		readChapterList.value = {
			...readChapterList.value,
			[r.slug]: {
				...readChapterList.value[r.slug],
				[chap.number]: true,
			},
		};
	};

	return (
		<>
			{r ? (
				<div class="modal modal-lg fade show" data-bs-theme="dark" id="readerModal" style={hide ? "display:none" : "display:block"} aria-labelledby="readerModalLabel" aria-hidden="true" role="dialog">
					<div class="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable fadeInEaseIn">
						<div class="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
							<div class="modal-content">
								<div class="modal-header">
									<h1 class="modal-title fs-5" id="readerModalLabel">
										<a>
											{r.title} - {r.chapters.length} Chapters
										</a>
									</h1>

									<div class="btn-top-close">

										<button
											type="button"
											class="btn"
											onClick={() => {
												if (!r?.slug) return "";
												if (!readChapterList.value[r.slug]) return;
												readChapterList.value = {
													...readChapterList.value,
													[r.slug]: {},
												};
											}}>
											<i class="fa-solid fa-trash" style="color: rgb(179, 0, 0);font-size: 24px;"></i>
										</button>

										<button
											type="button"
											class="btn-close"
											data-bs-dismiss="modal"
											aria-label="Close"
											onClick={() => {
												hide = true;
												if (showMangaDetails) showMangaDetails.value = null;
											}}></button>
									</div>
								</div>
								<div class="modal-body row">
									<div class="row mb-1">
										<div class="col-12 col-sm-12 col-md-12 col-xl-3 text-center">
											<img src={`/api/image?path=` + r.imgUrl} alt={r.title} class="rounded mx-auto" width="100%" style="max-width:400px" />
										</div>
										<div class="col-12 col-sm-12 col-md-12 col-xl-9">
											<h1>{r.title}</h1>
											<p class="text-dark-emphasis fw-bold">{r.sypnosis}</p>
											<div class="row row-cols-1 row-cols-lg-3">
												<div class="col mb-1">
													<h5>Artist :</h5>
													{r.Artist}
												</div>
												<div class="col mb-1">
													<h5>Author :</h5>
													{r.Author}
												</div>
												<div class="col mb-1">
													<h5>Serialization :</h5>
													{r.Serialization}
												</div>
												<div class="col mb-1">
													<h5>Posted By :</h5>
													{r.Posted_By}
												</div>
												<div class="col mb-1">
													<h5>Posted On :</h5>
													{formatDate(r.Posted_On)} {getCurrentTimeZoneUTC()}
													
												</div>
												<div class="col mb-1">
													<h5>Updated On :</h5>
													{formatDate(r.Updated_On)} {getCurrentTimeZoneUTC()}
												</div>
											</div>
											<h5>Genres :</h5>
											<div class="row row-cols-1 row-cols-sm-4 row-cols-md-6 row-cols-lg-8">
												{r.genres.map((genre) => {
													const href = `?genres=${genre}`;
													return (
														<a class="text-decoration-none border border-primary rounded m-1 p-1 col" href={href}>
															{genre}
														</a>
													);
												})}
											</div>
										</div>
									</div>
									<div class="row row-cols-lg-3 row-cols-sm-2 row-cols-2 mt-2">
										{r.chapters.map((chap) => {
											if (!r?.slug) return "";
											let read = false;
											if (readChapterList.value) {
												if (readChapterList.value[r.slug]?.[chap.number] === true) {
													read = true;
												}
											}

											return (
												<div class="col">
													<div class="m-1">
														<a data-target="#readerModalPage" data-toggle="modal" id="readerModalButtonPage" data-bs-slug={chap.number} class="text-decoration-none readerModalButtonPage" data-chap={chap.number} onClick={readChapter}>
															<div class={read ? "text-white bg-success text-white p-2 rounded" : "bg-secondary-subtle text-white p-2 rounded"}>
																<h6>{chap.title}</h6>
																<p>{chap.date}</p>
															</div>
														</a>
													</div>
												</div>
											);
										})}
									</div>
								</div>
								<div class="modal-footer"></div>
							</div>
						</div>
					</div>
					<div
						class="modal-backdrop"
						onClick={() => {
							hide = true;
							if (showMangaDetails) showMangaDetails.value = null;
						}}></div>
				</div>
			) : (
				<></>
			)}
		</>
	);
}
