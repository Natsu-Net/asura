import { showMangaDetails } from "../utils/manga.ts";
import { showChapterRead, readChapterList } from "../utils/manga.ts";
import { signal } from "@preact/signals";

import type { Manga, Chapter } from "../utils/manga.ts";
import { useEffect, useState } from "preact/hooks";
import { JSX } from "preact/jsx-runtime";

export default function ChapterReader() {
	const chapter = showChapterRead.value;
	const Manga = showMangaDetails.value;

	const autohide = signal("display:flex");

	const [pages, setPages] = useState<JSX.Element[]>([]);
	let sc_chapter = showChapterRead.value as unknown as Chapter;

	let lastScroll = 0;
	let trigger = false;
	const chapterScroll: {
		number: number;
		name: string;
		scrollStart: number;
		scrollEnd: number;
	}[] = [];

	const handleScroll = async (e: Event) => {
		const { scrollHeight, scrollTop, clientHeight } = e.target as HTMLDivElement;
		const target = e.target as HTMLDivElement;

		if (scrollTop >= lastScroll + 200 && autohide.value == "display:flex") {
			lastScroll = scrollTop;
			autohide.value = "display:none";
		} else if ((scrollTop <= lastScroll - 200 || scrollTop == 0) && autohide.value == "display:none") {
			lastScroll = scrollTop;
			autohide.value = "display:flex";
		} else if (Math.abs(scrollTop - lastScroll) >= 200) {
			lastScroll = scrollTop;
		}

		// check if current chapter is in chapterScroll
		if (sc_chapter && chapterScroll.find((e) => e.number == sc_chapter.number) == null) {
			chapterScroll.push({
				number: sc_chapter.number,
				name: sc_chapter.title,
				scrollStart: 0,
				scrollEnd: scrollHeight,
			});
		} else if (sc_chapter && chapterScroll.find((e) => e.number == sc_chapter.number) != null && chapterScroll.find((e) => e.number == sc_chapter.number)?.scrollEnd == -1) {
			// get the sroll of the last element in the target
			const lastElement = target.children[0].lastElementChild as HTMLImageElement;
			console.log(lastElement.offsetTop);
			chapterScroll.find((e) => e.number == sc_chapter.number)!.scrollEnd = lastElement.offsetTop + lastElement.clientHeight;
		}
		// check in witch chapter we are in by checking the scrollHeight, clientHeight and scrollTop to update the current chapter in the title
		for (const scrollChap of chapterScroll) {
			// get the center of the screen scroll
			const center = scrollTop + clientHeight / 2;

			if (center >= scrollChap.scrollStart && center <= scrollChap.scrollEnd) {
				// update the title
				const header = target.parentElement?.getElementsByTagName("a")[0];
				if (header) {
					header.textContent = `${Manga?.title} - Chapter ${scrollChap.number}`;
				}
				sc_chapter = Manga?.chapters.find((e) => Number(e.number) == scrollChap.number) as unknown as Chapter;
				break;
			}
		}

		if (Math.abs(scrollHeight - clientHeight - scrollTop) <= 2000 && !trigger) {
			trigger = true;
			setTimeout(() => {
				trigger = false;
			}, 3000);

			// fetch next chapter

			// get current chapter
			if (sc_chapter == null) return;

			// get next chapter
			const next_chapter = Manga?.chapters.find((e) => Number(e.number) == Number(sc_chapter.number) + 1) as unknown as Chapter;

			if (next_chapter == null) return;

			// get previous chapter from the chapterScroll
			const prev_chapter = chapterScroll.find((e) => e.number == sc_chapter.number);

			// add the chapter to the chapterScroll if it doesnt exist yet

			// fetch next chapter
			const rs = (await fetch((next_chapter.pages as string) ?? "").then((e) => e.json())) as string[];
			console.log(rs);
			const se = rs.map((e, i) => {
				return `<img src="${e}" class="img-fluid autohide" width="100%" alt="${i.toString()}" />`;
			});

			// append to the end of the current chapter
			target.children[0].insertAdjacentHTML("beforeend", se.join(""));
			sc_chapter = next_chapter;

			// update the read chapter list
			if (!Manga?.slug) return "";
			if (!readChapterList.value[Manga?.slug]) readChapterList.value[Manga?.slug] = {};
			readChapterList.value = {
				...readChapterList.value,
				[Manga?.slug]: {
					...readChapterList.value[Manga?.slug],
					[next_chapter.number]: true,
				},
			};

			// change the title
			const header = target.parentElement?.getElementsByTagName("a")[0];
			if (header) {
				header.textContent = `${Manga?.title} - Chapter ${next_chapter.number}`;
			}

			setTimeout(() => {
				const lastElement = target.children[0].lastElementChild as HTMLImageElement;
				console.log(lastElement.offsetTop);
				// check if current chapter is in chapterScroll
				const chap = chapterScroll.find((e) => e.number == next_chapter.number);
				console.log(prev_chapter);
				if (chap) {
					chap.scrollEnd = lastElement.offsetTop + lastElement.clientHeight;
					chap.scrollStart = prev_chapter ? prev_chapter.scrollEnd + 1 : 0;
				} else {
					chapterScroll.push({
						number: next_chapter.number,
						name: next_chapter.title,
						scrollStart: prev_chapter ? prev_chapter.scrollEnd + 1 : 0,
						scrollEnd: -1,
					});
				}
			}, 1000);
		}
	};

	useEffect(() => {
		if (chapter == null) return;
		(async () => {
			// check if theres a pages 0 in the chapter

			const rs = (await fetch((chapter?.pages as string) ?? "").then((e) => e.json())) as string[];
			console.log(rs);
			const se = rs.map((e, i) => {
				return <img src={e} class="img-fluid autohide" width="100%" alt={i.toString()} />;
			});

			setPages(se);
		})();
		return () => {};
	}, [chapter]);

	return (
		<>
			{chapter ? (
				<>
					<div class={chapter ? "modal fade modal-lg show" : "modal fade modal-lg"} data-bs-theme="dark" id="readerModalPage" style={chapter ? "display:block" : "display:none"} aria-labelledby="readerModalPageLabel" aria-hidden="true">
						<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-fullscreen fadeIn">
							<div class="modal-content">
								<div class="modal-header" id="autoHideTarget" style={autohide}>
									{chapter ? (
										<h1 class="modal-title fs-5" id="readerModalLabel" style="max-width: 80%;">
											<a id="chapter-title" href={chapter.url ?? ""}>
												{Manga?.title} - Chapter {chapter.number}
											</a>
										</h1>
									) : (
										""
									)}
									<button
										type="button"
										class="btn-close"
										data-bs-dismiss="modal"
										aria-label="Close"
										onClick={() => {
											showChapterRead.value = null;
										}}></button>
								</div>
								<div
									class="modal-body p-0"
									id="scrollImgArea"
									onScroll={handleScroll}
									onClick={() => {
										if (autohide.value == "display:none") autohide.value = "display:flex";
										else autohide.value = "display:none";
									}}>
									<div class="vstack col-md-3 mx-auto" id="scrollImgAreaReplace">
										{pages}
									</div>
								</div>
							</div>
						</div>
					</div>
					<div
						class="modal-backdrop"
						style={chapter ? "display:block" : "display:none"}
						onClick={() => {
							showChapterRead.value = null;
						}}></div>
				</>
			) : (
				""
			)}
		</>
	);
}
