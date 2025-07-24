import { showChapterRead, showMangaDetails, readChapterList } from "../utils/manga.ts";
import { IS_BROWSER } from "$fresh/runtime.ts";
import type { Manga } from "../utils/manga.ts";
import { signal } from "@preact/signals";

// Chapter pagination state
const chapterPage = signal(1);
const chaptersPerPage = 12;

// Format date with proper type handling
const formatDate = (sdate: string | Date | undefined) => {
	if (!sdate) return "Unknown";
	const date = new Date(sdate);
	if (isNaN(date.getTime())) return "Invalid Date";
	
	const hours = date.getHours() < 10 ? `0${date.getHours()}` : date.getHours();
	const minutes = date.getMinutes() < 10 ? `0${date.getMinutes()}` : date.getMinutes();
	const day = date.getDate() < 10 ? `0${date.getDate()}` : date.getDate();
	const month = date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1;
	const year = date.getFullYear();
	return `${hours}:${minutes} - ${day}/${month}/${year}`;
};

// Return current time zone as : UTC+2 or UTC-2
const getCurrentTimeZoneUTC = () => {
	const date = new Date();
	const timeZone = date.getTimezoneOffset() / 60;
	if (timeZone < 0) {
		return `UTC${timeZone}`;
	} else {
		return `UTC+${timeZone}`;
	}
};

export default function MangaDetails() {
	const r = showMangaDetails.value;

	// Helper function to get unique chapter count
	const getUniqueChapterCount = (chapters: any[]) => {
		if (!chapters) return 0;
		return new Set(chapters.map(ch => String(ch.number))).size;
	};

	// Reset chapter page when manga changes
	if (r && chapterPage.value !== 1) {
		chapterPage.value = 1;
	}
	let _hide = false;

	const readChapter = async (e: Event) => {
		if (!IS_BROWSER) return;
		e.preventDefault();
		
		let target = e.target as HTMLElement;
		let chapNumber: string | null = target.getAttribute("data-chap");
		
		// If target doesn't have the attribute, check parent elements
		if (!chapNumber) {
			target = target.parentElement as HTMLElement;
			chapNumber = target?.getAttribute("data-chap");
			if (!chapNumber) {
				target = target.parentElement as HTMLElement;
				chapNumber = target?.getAttribute("data-chap");
			}
		}

		if (!chapNumber || !r?.chapters) {
			console.error("Chapter number not found or no chapters available");
			return;
		}

		// Find the chapter by number
		const chap = r.chapters.find((c) => String(c.number) === String(chapNumber));
		
		if (!chap) {
			console.error("Chapter not found:", chapNumber);
			return;
		}

		try {
			// Fetch chapter details with images
			const response = await fetch(`/api/${r.slug}/chapter/${chap.number}`);
			
			if (!response.ok) {
				throw new Error(`Failed to fetch chapter: ${response.status}`);
			}
			
			const chapterDetails = await response.json();
			console.log("Chapter details fetched:", chapterDetails);
			
			// Set the chapter with pages (images)
			showChapterRead.value = {
				...chap,
				pages: chapterDetails.pages || chapterDetails || [],
				images: chapterDetails.images || ""
			};
		} catch (error) {
			console.error("Failed to fetch chapter details:", error);
			// Fallback to basic chapter without images - this will trigger an error in ChapterReader
			showChapterRead.value = {
				...chap,
				pages: [], // Empty array to prevent undefined errors
				images: ""
			};
		}

		if (!r?.slug) return;
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
		<div>
			{r ? (
				<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-80 backdrop-blur-sm">
					<div class="relative w-full max-w-6xl max-h-[90vh] bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl overflow-hidden">
						{/* Modern Header */}
						<div class="flex items-center justify-between p-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
							<div class="flex items-center gap-4">
								<h1 class="text-2xl font-bold">{r.title}</h1>
								<div class="px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm font-medium">
									{r.chapters.length} Chapters
								</div>
							</div>
							
							<div class="flex items-center gap-2">
								<button
									type="button"
									class="p-2 bg-white bg-opacity-10 rounded-lg hover:bg-opacity-20 transition-all duration-200 hover:scale-105"
									title="Clear reading history"
									onClick={() => {
										if (!r?.slug) return;
										if (!readChapterList.value[r.slug]) return;
										readChapterList.value = {
											...readChapterList.value,
											[r.slug]: {},
										};
									}}>
									<i class="fa-solid fa-trash"></i>
								</button>

								<button
									type="button"
									class="p-2 bg-white bg-opacity-10 rounded-lg hover:bg-opacity-20 transition-all duration-200 hover:scale-105"
									onClick={() => {
										_hide = true;
										if (showMangaDetails) showMangaDetails.value = null;
									}}>
									<i class="fa-solid fa-times"></i>
								</button>
							</div>
						</div>

						{/* Modern Body */}
						<div class="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
							{/* Hero Section */}
							<div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
								<div class="lg:col-span-1">
									<div class="relative rounded-xl overflow-hidden shadow-2xl group">
										<img src={r.imgUrl} alt={r.title} class="w-full h-96 lg:h-[500px] object-cover transition-transform duration-300 group-hover:scale-105" />
										<div class="absolute top-4 right-4 flex flex-col gap-2">
											<div class="px-2 py-1 bg-black bg-opacity-70 rounded-lg text-white text-xs font-medium backdrop-blur-sm">
												⭐ {r.Rating > 0 ? r.Rating.toFixed(1) : "N/A"}
											</div>
											<div class="px-2 py-1 bg-black bg-opacity-70 rounded-lg text-white text-xs font-medium backdrop-blur-sm">
												👥 {r.Followers.toLocaleString()}
											</div>
										</div>
									</div>
								</div>
								
								<div class="lg:col-span-2 space-y-6">
									<div>
										<h2 class="text-3xl font-bold text-white mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
											{r.title}
										</h2>
										<p class="text-gray-300 leading-relaxed">{r.sypnosis}</p>
									</div>
									
									{/* Quick Info Grid */}
									<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div class="p-4 bg-white bg-opacity-5 rounded-lg border border-gray-700 hover:border-blue-500 transition-colors duration-200">
											<span class="block text-xs text-gray-400 uppercase font-medium mb-1">Artist</span>
											<span class="text-white font-semibold">{r.Artist || "Unknown"}</span>
										</div>
										<div class="p-4 bg-white bg-opacity-5 rounded-lg border border-gray-700 hover:border-blue-500 transition-colors duration-200">
											<span class="block text-xs text-gray-400 uppercase font-medium mb-1">Author</span>
											<span class="text-white font-semibold">{r.Author || "Unknown"}</span>
										</div>
										<div class="p-4 bg-white bg-opacity-5 rounded-lg border border-gray-700 hover:border-blue-500 transition-colors duration-200">
											<span class="block text-xs text-gray-400 uppercase font-medium mb-1">Status</span>
											<span class="inline-block px-2 py-1 bg-green-600 text-white text-xs rounded-md font-medium">{r.Status}</span>
										</div>
										<div class="p-4 bg-white bg-opacity-5 rounded-lg border border-gray-700 hover:border-blue-500 transition-colors duration-200">
											<span class="block text-xs text-gray-400 uppercase font-medium mb-1">Serialization</span>
											<span class="text-white font-semibold">{r.Serialization || "Unknown"}</span>
										</div>
										<div class="p-4 bg-white bg-opacity-5 rounded-lg border border-gray-700 hover:border-blue-500 transition-colors duration-200">
											<span class="block text-xs text-gray-400 uppercase font-medium mb-1">Posted By</span>
											<span class="text-white font-semibold">{r.Posted_By || "Unknown"}</span>
										</div>
										<div class="p-4 bg-white bg-opacity-5 rounded-lg border border-gray-700 hover:border-blue-500 transition-colors duration-200">
											<span class="block text-xs text-gray-400 uppercase font-medium mb-1">Last Updated</span>
											<span class="text-white font-semibold">{formatDate(r.Updated_On)} {getCurrentTimeZoneUTC()}</span>
										</div>
									</div>
									
									{/* Genre Tags */}
									<div>
										<h6 class="text-white font-semibold mb-3">Genres</h6>
										<div class="flex flex-wrap gap-2">
											{r.genres.map((genre) => (
												<a 
													href={`?genres=${genre}`} 
													class="px-3 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full text-sm font-medium hover:shadow-lg hover:-translate-y-1 transition-all duration-200 no-underline"
												>
													{genre}
												</a>
											))}
										</div>
									</div>
								</div>
							</div>

							{/* Chapters Section */}
							<div>
								<div class="flex justify-between items-center mb-6">
									<h4 class="text-xl font-bold text-white">
										Chapters ({(() => {
											// Count unique chapters
											const uniqueChapters = new Set(r.chapters.map(ch => String(ch.number)));
											return uniqueChapters.size;
										})()})
									</h4>
									{(() => {
										const uniqueCount = new Set(r.chapters.map(ch => String(ch.number))).size;
										return uniqueCount > chaptersPerPage ? (
											<div class="flex items-center gap-2 text-gray-400 text-sm">
												<span>
													{(() => {
														const uniqueCount = new Set(r.chapters.map(ch => String(ch.number))).size;
														return `${Math.min((chapterPage.value - 1) * chaptersPerPage + 1, uniqueCount)} - ${Math.min(chapterPage.value * chaptersPerPage, uniqueCount)} of ${uniqueCount}`;
													})()}
												</span>
											</div>
										) : null;
									})()}
								</div>								<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
									{(() => {
										// Deduplicate chapters by number, keeping the cleaner title
										const chapterMap = new Map();
										r.chapters.forEach(ch => {
											const number = String(ch.number);
											const existing = chapterMap.get(number);
											
											if (!existing) {
												chapterMap.set(number, ch);
											} else {
												// Keep the chapter with the cleaner title
												const newTitle = ch.title.trim();
												const existingTitle = existing.title.trim();
												
												// Prefer shorter, standard "Chapter X" format
												if (newTitle.length < existingTitle.length && newTitle.match(/^Chapter\s+[0-9]+$/i)) {
													chapterMap.set(number, ch);
												} else if (!existingTitle.match(/^Chapter\s+[0-9]+$/i) && newTitle.match(/^Chapter\s+[0-9]+$/i)) {
													chapterMap.set(number, ch);
												}
											}
										});
										
										return Array.from(chapterMap.values())
											.slice((chapterPage.value - 1) * chaptersPerPage, chapterPage.value * chaptersPerPage);
									})()
										.map((chap) => {
											if (!r?.slug) return null;
											let read = false;
											if (readChapterList.value) {
												if (readChapterList.value[r.slug]?.[chap.number] === true) {
													read = true;
												}
											}

											return (
												<div class="w-full">
													<button 
														type="button"
														class={`w-full p-4 rounded-xl border transition-all duration-200 text-left hover:shadow-lg hover:-translate-y-1 ${
															read 
																? 'bg-gradient-to-r from-green-600 to-emerald-600 border-green-500 text-white' 
																: 'bg-white bg-opacity-5 border-gray-700 text-white hover:border-blue-500'
														}`}
														data-chap={chap.number}
														onClick={readChapter}
													>
														<div class="space-y-2">
															<div class="flex justify-between items-center">
																<span class="text-sm font-semibold text-blue-400">Ch. {chap.number}</span>
																{read && <span class="text-white font-bold">✓</span>}
															</div>
															<h6 class="font-semibold leading-snug">{chap.title}</h6>
															<p class="text-sm text-gray-400">{chap.date}</p>
														</div>
													</button>
												</div>
											);
									})}
								</div>
								
								{/* Chapter Pagination */}
								{r.chapters.length > chaptersPerPage && (
									<div class="flex justify-center mt-8">
										<div class="flex items-center space-x-2">
											<button 
												type="button"
												class={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
													chapterPage.value === 1 
														? 'text-gray-500 cursor-not-allowed' 
														: 'text-white hover:bg-white hover:bg-opacity-10'
												}`}
												disabled={chapterPage.value === 1}
												onClick={() => chapterPage.value = Math.max(1, chapterPage.value - 1)}
											>
												<i class="fa-solid fa-chevron-left"></i>
											</button>
											
											{Array.from({ length: Math.ceil(r.chapters.length / chaptersPerPage) }, (_, i) => i + 1)
												.filter(page => {
													const totalPages = Math.ceil(r.chapters.length / chaptersPerPage);
													if (totalPages <= 7) return true;
													if (page === 1 || page === totalPages) return true;
													if (page >= chapterPage.value - 2 && page <= chapterPage.value + 2) return true;
													return false;
												})
												.map((page, index, filteredPages) => {
													const prevPage = filteredPages[index - 1];
													const showEllipsis = prevPage && page - prevPage > 1;
													
													return (
														<>
															{showEllipsis && (
																<span class="px-2 py-2 text-gray-400">...</span>
															)}
															<button
																type="button"
																class={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
																	chapterPage.value === page
																		? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
																		: 'text-white hover:bg-white hover:bg-opacity-10'
																}`}
																onClick={() => chapterPage.value = page}
															>
																{page}
															</button>
														</>
													);
												})}
											
											<button 
												type="button"
												class={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
													chapterPage.value === Math.ceil(r.chapters.length / chaptersPerPage)
														? 'text-gray-500 cursor-not-allowed' 
														: 'text-white hover:bg-white hover:bg-opacity-10'
												}`}
												disabled={chapterPage.value === Math.ceil(r.chapters.length / chaptersPerPage)}
												onClick={() => chapterPage.value = Math.min(Math.ceil(r.chapters.length / chaptersPerPage), chapterPage.value + 1)}
											>
												<i class="fa-solid fa-chevron-right"></i>
											</button>
										</div>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
