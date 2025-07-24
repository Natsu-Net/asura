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

	// Helper function to load next chapter seamlessly
	const loadNextChapter = async (
		target: HTMLDivElement,
		manga: Manga | null,
		nextChapter: Chapter,
		prevChapter: { number: number; name: string; scrollStart: number; scrollEnd: number } | undefined,
		chapterScrollArray: { number: number; name: string; scrollStart: number; scrollEnd: number }[]
	) => {
		if (!manga?.slug) {
			console.error("No manga slug available");
			return;
		}

		try {
			console.log(`Fetching chapter ${nextChapter.number} from API...`);
			
			const response = await fetch(`/api/${manga.slug}/chapter/${nextChapter.number}`);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const chapterData = await response.json();
			console.log(`Received chapter data for ${nextChapter.number}:`, chapterData);
			
			const chapterPages = chapterData.pages;
			if (!chapterPages || chapterPages.length === 0) {
				console.error("Next chapter pages not available:", chapterPages);
				return;
			}

			// Handle both string array and single string
			let pageUrls: string[] = [];
			if (typeof chapterPages === 'string') {
				pageUrls = [chapterPages];
			} else if (Array.isArray(chapterPages)) {
				pageUrls = chapterPages;
			} else {
				console.error("Next chapter pages in unexpected format:", chapterPages);
				return;
			}

			console.log(`Adding ${pageUrls.length} pages for chapter ${nextChapter.number}`);

			// Create chapter separator
			const chapterSeparator = `<div class="flex justify-center bg-gray-800 py-4 my-2"><div class="text-white text-lg font-bold">Chapter ${nextChapter.number}: ${nextChapter.title}</div></div>`;

			// Create page elements
			const pageElements = pageUrls.map((pageUrl, i) => {
				return `<div class="flex justify-center"><img src="${pageUrl}" class="w-full max-w-full sm:max-w-2xl h-auto block" alt="Page ${i + 1}" loading="lazy" /></div>`;
			});

			// Append to the container
			const container = target.children[0] as HTMLElement;
			container.insertAdjacentHTML("beforeend", chapterSeparator + pageElements.join(""));
			
			// Update current chapter
			sc_chapter = nextChapter;

			// Update reading history
			if (!readChapterList.value[manga.slug]) readChapterList.value[manga.slug] = {};
			readChapterList.value = {
				...readChapterList.value,
				[manga.slug]: {
					...readChapterList.value[manga.slug],
					[nextChapter.number]: true,
				},
			};

			// Update title
			const header = target.parentElement?.getElementsByTagName("a")[0];
			if (header) {
				header.textContent = `${manga.title} - Chapter ${nextChapter.number}`;
			}

			// Update chapter scroll tracking
			setTimeout(() => {
				const lastElement = container.lastElementChild as HTMLElement;
				const chap = chapterScrollArray.find((e) => e.number == Number(nextChapter.number));
				
				if (chap) {
					chap.scrollEnd = lastElement.offsetTop + lastElement.clientHeight;
					chap.scrollStart = prevChapter ? prevChapter.scrollEnd + 1 : 0;
				} else {
					chapterScrollArray.push({
						number: Number(nextChapter.number),
						name: nextChapter.title,
						scrollStart: prevChapter ? prevChapter.scrollEnd + 1 : 0,
						scrollEnd: lastElement.offsetTop + lastElement.clientHeight,
					});
				}
			}, 500);

		} catch (error) {
			console.error("Error loading next chapter:", error);
		}
	};

	const handleScroll = (e: Event) => {
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
		if (sc_chapter && chapterScroll.find((e) => e.number == Number(sc_chapter.number)) == null) {
			chapterScroll.push({
				number: Number(sc_chapter.number),
				name: sc_chapter.title,
				scrollStart: 0,
				scrollEnd: scrollHeight,
			});
		} else if (sc_chapter && chapterScroll.find((e) => e.number == Number(sc_chapter.number)) != null && chapterScroll.find((e) => e.number == Number(sc_chapter.number))?.scrollEnd == -1) {
			// get the sroll of the last element in the target
			const lastElement = target.children[0].lastElementChild as HTMLImageElement;
			console.log(lastElement.offsetTop);
			chapterScroll.find((e) => e.number == Number(sc_chapter.number))!.scrollEnd = lastElement.offsetTop + lastElement.clientHeight;
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

		// Debug: Check how close we are to the bottom
		const distanceFromBottom = Math.abs(scrollHeight - clientHeight - scrollTop);
		if (distanceFromBottom <= 2000) {
			console.log(`Distance from bottom: ${distanceFromBottom}px, trigger: ${trigger}`);
		}

		// Improved seamless loading trigger
		if (distanceFromBottom <= 800 && !trigger) {
			trigger = true;
			console.log("🔄 Triggering seamless chapter loading...");
			
			// Reset trigger after 2 seconds to allow re-triggering
			setTimeout(() => {
				trigger = false;
				console.log("✅ Seamless loading trigger reset");
			}, 2000);

			// Get current chapter
			if (!sc_chapter) {
				console.log("❌ No current chapter found for seamless loading");
				return;
			}

			console.log(`📖 Current chapter: ${sc_chapter.number}`);

			// Find next chapter more reliably
			let next_chapter: Chapter | null = null;
			
			if (Manga?.chapters) {
				// First, try to find by incrementing chapter number
				next_chapter = Manga.chapters.find((ch) => Number(ch.number) === Number(sc_chapter.number) + 1) || null;
				
				// If not found, try to find the next chapter in the sorted list
				if (!next_chapter) {
					const currentIndex = Manga.chapters.findIndex(ch => String(ch.number) === String(sc_chapter.number));
					if (currentIndex !== -1 && currentIndex > 0) {
						// Chapters are sorted in descending order, so next chapter is at currentIndex - 1
						next_chapter = Manga.chapters[currentIndex - 1];
					}
				}
			}

			if (!next_chapter) {
				console.log("❌ No next chapter available");
				return;
			}

			console.log(`📄 Loading next chapter: ${next_chapter.number} (${next_chapter.title})`);

			// Get previous chapter for scroll tracking
			const prev_chapter = chapterScroll.find((e) => e.number === Number(sc_chapter.number));

			// Fetch chapter pages from API
			loadNextChapter(target, Manga, next_chapter, prev_chapter, chapterScroll);
		}
	};

	useEffect(() => {
		if (chapter == null) return;
		
		// Mark current chapter as read when opened
		if (Manga?.slug && chapter.number) {
			if (!readChapterList.value[Manga.slug]) readChapterList.value[Manga.slug] = {};
			readChapterList.value = {
				...readChapterList.value,
				[Manga.slug]: {
					...readChapterList.value[Manga.slug],
					[chapter.number]: true,
				},
			};
		}
		
		(() => {
			// Check if chapter has pages
			const chapterPages = chapter.pages;
			if (!chapterPages) {
				console.error("Chapter pages not available:", chapterPages);
				return;
			}

			// Handle both string array and single string
			let pageUrls: string[] = [];
			if (typeof chapterPages === 'string') {
				// If it's a single string, treat it as one page
				pageUrls = [chapterPages];
			} else if (Array.isArray(chapterPages)) {
				pageUrls = chapterPages;
			} else {
				console.error("Chapter pages in unexpected format:", chapterPages);
				return;
			}

			const se = pageUrls.map((pageUrl, i) => {
				return (
					<div key={i} class="flex justify-center">
						<img 
							src={pageUrl} 
							class="w-full max-w-full sm:max-w-2xl h-auto block" 
							alt={`Page ${i + 1}`}
							loading="lazy"
							onError={(e) => {
								const target = e.target as HTMLImageElement;
								target.src = '/static/loading.gif';
							}}
						/>
					</div>
				);
			});

			setPages(se);
		})();
		return () => {};
	}, [chapter]);

	return (
		<>
			{chapter ? (
				<>
					{/* Full screen overlay */}
					<div 
						class={chapter ? "fixed inset-0 z-50 bg-gray-900" : "hidden"}
						id="readerModalPage"
					>
						{/* Header */}
						<div 
							class="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700 px-4 py-2 sm:px-6 sm:py-3 transition-all duration-300"
							id="autoHideTarget" 
							style={autohide}
						>
							<div class="flex items-center justify-between">
								<div class="flex items-center space-x-3">
									<button 
										type="button"
										class="text-gray-400 hover:text-white transition-colors p-1"
										onClick={() => {
											showChapterRead.value = null;
										}}
									>
										<i class="fas fa-arrow-left text-xl"></i>
									</button>
									{chapter && (
										<div>
											<h1 class="text-white font-semibold text-lg sm:text-xl truncate max-w-[200px] sm:max-w-none">
												<a id="chapter-title" href={chapter.url ?? ""} class="hover:text-blue-400 transition-colors">
													{Manga?.title} - Chapter {chapter.number}
												</a>
											</h1>
										</div>
									)}
								</div>
								<button
									type="button"
									class="text-gray-400 hover:text-white transition-colors text-xl"
									onClick={() => {
										showChapterRead.value = null;
									}}
								>
									<i class="fas fa-times"></i>
								</button>
							</div>
						</div>

						{/* Content */}
						<div
							class="h-full overflow-auto bg-gray-900 pt-16"
							id="scrollImgArea"
							onScroll={handleScroll}
							onClick={() => {
								if (autohide.value == "display:none") autohide.value = "display:flex";
								else autohide.value = "display:none";
							}}
						>
							<div class="max-w-4xl mx-auto" id="scrollImgAreaReplace">
								{pages}
							</div>
						</div>
					</div>
				</>
			) : (
				""
			)}
		</>
	);
}
