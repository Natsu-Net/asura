import { useSignal, signal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { showMangaDetails } from "../utils/manga.ts";
import type { Manga } from "../utils/manga.ts";

const searchResults = signal<Manga[]>([]);
const isSearching = signal(false);
const showDropdown = signal(false);

export default function SearchBar() {
	const searchQuery = useSignal("");
	const searchTimeout = useSignal<number | null>(null);

	const performSearch = async (query: string) => {
		if (!query.trim()) {
			searchResults.value = [];
			showDropdown.value = false;
			return;
		}

		isSearching.value = true;
		try {
			const response = await fetch(`/api/?search=${encodeURIComponent(query)}&limit=5`);
			if (response.ok) {
				const data = await response.json();
				searchResults.value = data.data || [];
				showDropdown.value = true;
			}
		} catch (error) {
			console.error("Search error:", error);
			searchResults.value = [];
		} finally {
			isSearching.value = false;
		}
	};

	const handleInput = (e: Event) => {
		const target = e.target as HTMLInputElement;
		const query = target.value;
		searchQuery.value = query;

		// Clear previous timeout
		if (searchTimeout.value) {
			clearTimeout(searchTimeout.value);
		}

		// Debounce search
		searchTimeout.value = setTimeout(() => {
			performSearch(query);
		}, 300);
	};

	const handleMangaClick = (manga: Manga, e?: Event) => {
		if (e) {
			e.preventDefault();
			e.stopPropagation();
		}
		showMangaDetails.value = manga;
		showDropdown.value = false;
		searchQuery.value = "";
		searchResults.value = [];
	};

	const handleSubmit = (e: Event) => {
		e.preventDefault();
		if (searchResults.value.length > 0) {
			handleMangaClick(searchResults.value[0]);
		}
	};

	const handleBlur = () => {
		// Delay hiding dropdown to allow clicks on results
		setTimeout(() => {
			showDropdown.value = false;
		}, 150);
	};

	const handleFocus = () => {
		if (searchResults.value.length > 0) {
			showDropdown.value = true;
		}
	};

	useEffect(() => {
		return () => {
			if (searchTimeout.value) {
				clearTimeout(searchTimeout.value);
			}
		};
	}, []);

	return (
		<form class="flex-1 max-w-xs sm:max-w-md mx-4 sm:mx-8 relative" role="search" onSubmit={handleSubmit}>
			<div class="relative">
				<i class="fa-solid fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm"></i>
				<input 
					class="w-full pl-8 sm:pl-10 pr-10 sm:pr-12 py-2 text-sm bg-white bg-opacity-10 border border-gray-600 rounded-lg placeholder-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" 
					type="search" 
					placeholder="Search manga..." 
					aria-label="Search"
					value={searchQuery.value}
					onInput={handleInput}
					onBlur={handleBlur}
					onFocus={handleFocus}
					autocomplete="off"
				/>
				{isSearching.value ? (
					<div class="absolute right-2 top-1/2 transform -translate-y-1/2 p-1">
						<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
					</div>
				) : (
					<button class="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-blue-400 hover:text-blue-300 transition-colors" type="submit">
						<i class="fa-solid fa-arrow-right text-sm"></i>
					</button>
				)}
			</div>

			{/* Search Results Dropdown */}
			{showDropdown.value && searchResults.value.length > 0 && (
				<div class="absolute top-full left-0 right-0 mt-2 bg-gray-800 bg-opacity-95 backdrop-blur-md border border-gray-600 rounded-lg shadow-2xl z-50 max-h-80 overflow-y-auto">
					{searchResults.value.map((manga) => (
						<div
							key={manga.slug}
							class="flex items-center gap-3 p-3 hover:bg-gray-700 hover:bg-opacity-50 cursor-pointer transition-colors border-b border-gray-700 last:border-b-0"
							onClick={(e) => handleMangaClick(manga, e)}
						>
							<img 
								src={manga.imgUrl} 
								alt={manga.title}
								class="w-12 h-16 object-cover rounded-md flex-shrink-0"
								loading="lazy"
							/>
							<div class="flex-1 min-w-0">
								<h3 class="text-white font-medium text-sm truncate">{manga.title}</h3>
								<p class="text-gray-400 text-xs mt-1 overflow-hidden" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{manga.description || "No description available"}</p>
								<div class="flex items-center gap-2 mt-1">
									<span class="text-xs text-blue-400">{manga.chapters?.length || 0} chapters</span>
									{manga.status && (
										<span class={`text-xs px-2 py-0.5 rounded-full ${
											String(manga.status).toLowerCase() === 'ongoing' 
												? 'bg-green-500 bg-opacity-20 text-green-400' 
												: 'bg-gray-500 bg-opacity-20 text-gray-400'
										}`}>
											{String(manga.status)}
										</span>
									)}
								</div>
							</div>
							<i class="fa-solid fa-chevron-right text-gray-400 text-xs"></i>
						</div>
					))}
					{searchResults.value.length === 5 && (
						<div class="p-3 text-center">
							<span class="text-xs text-gray-400">Showing top 5 results. Press Enter for more.</span>
						</div>
					)}
				</div>
			)}

			{/* No Results Message */}
			{showDropdown.value && searchQuery.value.trim() && searchResults.value.length === 0 && !isSearching.value && (
				<div class="absolute top-full left-0 right-0 mt-2 bg-gray-800 bg-opacity-95 backdrop-blur-md border border-gray-600 rounded-lg shadow-2xl z-50 p-4 text-center">
					<i class="fa-solid fa-search text-gray-400 text-2xl mb-2"></i>
					<p class="text-gray-400 text-sm">No manga found for "{searchQuery.value}"</p>
				</div>
			)}
		</form>
	);
}
