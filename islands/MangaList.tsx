import { Signal } from "@preact/signals";
import { Manga, showMangaDetails } from "../utils/manga.ts";

function MangaDisplay(manga: Manga) {
	async function openModal() {
		// fetch manga details

		const mangaDetails = await fetch(`/api/${manga.slug}?includeChapters=true`).then((res) => res.json()) as Manga;

		showMangaDetails.value = mangaDetails;
	}

	

	return (
		<div class="col-12 col-sm-6 col-md-6 col-lg-4 col-xl-3 col-xxl-2 text-center">
			<div class="position-relative m-2 manga-card top-50 start-50 translate-middle">
				<a data-target="#readerModal" data-toggle="modal" id="readerModalButton" data-bs-slug={manga.slug} class="text-decoration-none readerModalButton" onClick={openModal}>
					<img src={manga.imgUrl} alt={manga.title} class="shadow-lg bg-body-tertiary rounded" />
					<div class="manga-details rounded">
						<p class="manga-title">{manga.title}</p>
					</div>
				</a>
			</div>
		</div>
	);
}

export default function MangaList({ Mangas } : { Mangas: Signal<Manga[]> } ) {

	if (Mangas.value[0].slug == "loading") {
		return (
			// center the spinner in the middle of the page taking the full height of the cards container
			<div class="d-flex justify-content-center align-items-center" style="height:70vh">
				<div class="spinner-border text-primary" role="status">
					<span class="visually-hidden">Loading...</span>
				</div>
			</div>
		);
	}

	return (<>{Mangas.value.map((manga) => MangaDisplay(manga))}</>);
}
