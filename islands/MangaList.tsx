import { Signal } from "@preact/signals";
import { Manga, showMangaDetails } from "../utils/manga.ts";

function MangaDisplay(manga: Manga) {
	async function openModal() {
		// Fetch manga details with loading state
		try {
			const mangaDetails = await fetch(`/api/${manga.slug}?includeChapters=true`).then((res) => res.json()) as Manga;
			showMangaDetails.value = mangaDetails;
		} catch (error) {
			console.error("Failed to fetch manga details:", error);
		}
	}

	return (
		<div class="group cursor-pointer">
			<div class="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-gray-700 hover:border-blue-500 h-full" onClick={openModal}>
				<div class="relative overflow-hidden">
					<img src={manga.imgUrl} alt={manga.title} class="w-full h-48 sm:h-56 md:h-64 object-cover transition-transform duration-300 group-hover:scale-110" loading="lazy" />
					<div class="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
						<div class="absolute bottom-0 left-0 right-0 p-3 sm:p-4 text-white">
							<h3 class="text-sm sm:text-base lg:text-lg font-bold mb-2 leading-tight line-clamp-2">{manga.title}</h3>
							<div class="flex flex-wrap gap-1 sm:gap-2 mb-2 sm:mb-3">
								{manga.Rating > 0 && (
									<span class="px-2 py-1 bg-yellow-600 rounded-full text-xs font-medium">
										⭐ {manga.Rating.toFixed(1)}
									</span>
								)}
								{manga.Status && (
									<span class="px-2 py-1 bg-green-600 rounded-full text-xs font-medium">
										{manga.Status}
									</span>
								)}
							</div>
							<div class="flex flex-wrap gap-1 mb-2">
								{manga.genres.slice(0, 2).map((genre) => (
									<span class="px-2 py-1 bg-white bg-opacity-20 rounded-md text-xs font-medium backdrop-blur-sm">{genre}</span>
								))}
								{manga.genres.length > 2 && (
									<span class="px-2 py-1 bg-blue-600 rounded-md text-xs font-medium">+{manga.genres.length - 2}</span>
								)}
							</div>
						</div>
					</div>
				</div>
				<div class="p-3 sm:p-4">
					<h4 class="text-white font-bold text-sm sm:text-base lg:text-lg mb-2 leading-tight group-hover:text-blue-400 transition-colors duration-200 line-clamp-2">{manga.title}</h4>
					<div class="flex items-center justify-between text-xs sm:text-sm text-gray-400">
						<span class="flex items-center gap-1">
							<i class="fa-solid fa-book text-blue-400"></i>
							{manga.chapters?.length || 0} chapters
						</span>
						{manga.Followers > 0 && (
							<span class="flex items-center gap-1">
								<i class="fa-solid fa-users text-purple-400"></i>
								<span class="hidden sm:inline">{manga.Followers.toLocaleString()}</span>
								<span class="sm:hidden">{manga.Followers > 1000 ? `${(manga.Followers/1000).toFixed(1)}k` : manga.Followers}</span>
							</span>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

export default function MangaList({ Mangas }: { Mangas: Signal<Manga[]> }) {
	if (Mangas.value.length > 0 && Mangas.value[0].slug === "loading") {
		return (
			<div class="flex flex-col items-center justify-center py-16">
				<div class="relative">
					<div class="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
					<div class="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0" style="animation-delay: -0.15s"></div>
					<div class="w-16 h-16 border-4 border-pink-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0" style="animation-delay: -0.3s"></div>
				</div>
				<p class="text-white text-lg mt-4 font-medium">Loading manga collection...</p>
			</div>
		);
	}

	if (Mangas.value.length === 0) {
		return (
			<div class="flex flex-col items-center justify-center py-16 text-center">
				<div class="w-24 h-24 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center mb-6">
					<i class="fa-solid fa-book-open text-white text-3xl"></i>
				</div>
				<h3 class="text-white text-2xl font-bold mb-2">No manga found</h3>
				<p class="text-gray-400">Try adjusting your search or filters</p>
			</div>
		);
	}

	return (
		<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-6">
			{Mangas.value.map((manga) => MangaDisplay(manga))}
		</div>
	);
}
