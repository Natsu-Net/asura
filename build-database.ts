import "https://deno.land/x/dotenv@v3.2.2/load.ts";
import AsuraParser from "./parser/sites/asura.ts";

import { MongoClient } from "https://deno.land/x/mongo@v0.31.2/mod.ts";
import { Manga } from "./utils/manga.ts";
const client = new MongoClient();

await client.connect(Deno.env.get("MONGO_URI") ?? "");

const db = client.database("asura");

const dbManga = db.collection("manga");

interface dbChapters {
		_id : string,
		mangaId : string,
		images : Array<string>,
		title : string,
		url : string,
		date : string,

}

const dbChapters = db.collection("chapters");

// print current directory

const parser = new AsuraParser();

async function main() {
	console.log(parser.domain);

	for await (const manga of parser.getMangaList()) {
		// check if manga is already in the database
		const mangaData = await dbManga.find({
			$or: [{ slug: manga.slug }, { originalSlug: manga.originalSlug }, { title: manga.title }],
			// join chapters array
		}).toArray();

		if (mangaData.length > 1) {
			
			// delete all duplicates if they all have the same slug
			console.log("Found duplicates for " + mangaData[0].title);
			console.log("Checking if they have the same slug");
			let sameSlug = false;
			for (let i = 0; i < mangaData.length; i++) {
				if (mangaData[i].slug === mangaData[0].slug) {
					sameSlug = true;
				} else {
					sameSlug = false;
					break;
				}
			}

			if (sameSlug) {
				console.log("They have the same slug, deleting all duplicates");
				const MostChapters = await dbChapters.find({
					mangaId: mangaData[0]._id
				}).toArray() as dbChapters[];

				// find the one with the most chapters and delete the rest
				let mostChapters = mangaData[0];
				for (let i = 0; i < mangaData.length; i++) {
					const chapters = await dbChapters.find({
						mangaId: mangaData[i]._id
					}).toArray() as dbChapters[];

					if (chapters.length > MostChapters.length) {
						mostChapters = MostChapters;
						console.log("Found most chapters for " + mangaData[i].title + " with " + mangaData[i].chapters.length + " chapters" + " id: " + mangaData[i]._id);
					}
				}

				for (let i = 0; i < mangaData.length; i++) {
					if (mangaData[i]._id !== mostChapters.mangaId) {
						await dbManga.deleteOne({ _id: mangaData[i]._id });
						console.log(`Deleted ${mangaData[i].title} because it was a duplicate, id: ${mangaData[i]._id}`);
					}
				}
			}
			console.log("Finished deleting duplicates");
		}


		if (mangaData[0]) {
			// check if there's a new chapter in the manga

			if (mangaData[0].chapters.length < manga.chapters.length) {
				const chap = await manga.parseChapters();
				
				// get all chapters in the database
				const Chapters = await dbChapters.find({
					mangaId: mangaData[0]._id
				}).toArray() as dbChapters[];
				// check if there's a new chapter
				const newChapters = chap.chapters.filter((chapter: { url: string; }) => {
					return !Chapters.some((dbChapter: { url: string; }) => {
						return dbChapter.url === chapter.url;
					})
				})
				
				if (newChapters.length > 0) {
					const list = await dbChapters.insertMany(newChapters.map((chapter:any) => {
						return {
							mangaId: mangaData[0]._id,
							images: chapter.pages,
							title: chapter.title,
							url: chapter.url,
							date: chapter.date,
							number: parseInt(chapter.title.split(" ")[1])
						}
					}));
					console.log(`Inserted ${newChapters.length} new chapters for ${manga.title}`);
					

					// delete old chapters
					delete mangaData[0].chapters;
					mangaData[0].chapters = list.insertedIds.map((id: any) => {
						return {
							_id: id,
						}
					})
				}


				// mangaData[0] the manga in the database
				// update updated_on
				mangaData[0].Updated_On = new Date();

				// delete old chapters

				// parse chapters


				await dbManga.updateOne(
					{
						_id: mangaData[0]._id,
					},
					{
						$set: {
							...mangaData[0]
						}
					},
				);
				console.log(`Updated ${manga.title} with ${newChapters.length} new chapters`);
			} else {
				console.log(`No new chapters for ${manga.title}`);
			}

		} else {
			const chap = await manga.parseChapters();
			manga.chapters = [];
			// insert manga into database
			const mangaDataID = await dbManga.insertOne({
				...manga,
			})
			const chapt: Array<{number : number}> = []

			const list = await dbChapters.insertMany(chap.chapters.map((chapter:any) => {
				const c_chapter = {
					number: parseInt(chapter.title.split(" ")[1])
				}
				chapt.push(c_chapter);

				return {
					mangaId: mangaDataID,
					images: chapter.pages,
					title: chapter.title,
					url: chapter.url,
					date: chapter.date,
					number: parseInt(chapter.title.split(" ")[1])
				}
			}));
			

			// // delete old chapters
			manga.chapters = chapt.map((chapter) => {
				return {
					number : chapter.number,
					_id: list.insertedIds[chapter.number - 1],
				}
			}) as any;

			// insert manga into database
			
			await dbManga.updateOne({
				_id: mangaDataID,
			}, {
				$set: {
					chapters: manga.chapters
				}
			})
			console.log(`Inserted ${manga.title}`);
			console.log(`Inserted ${manga.chapters.length} new chapters for ${manga.title}`);
		}
		
	}

	console.log("Finished updating database");

	
}

async function checkforNewDomains(){
	const config = db.collection("config");

	const domain = await config.findOne({
		name: "domain"
	});

	if (domain) {
		parser.domain = domain.value;
	}

	const oldDomain = new URL(parser.domain);
	// fetch old domain and check if it's still up do not follow redirects
	const response = await fetch(oldDomain, {
		method: "GET",
		redirect: "manual"
	})

	// if still up then do nothing
	if (response.status === 200) {
		console.log("Domain still up");
		return;
	}

	// if not up then fetch new domain from the redirect
	const newDomain = new URL(response.headers.get("location") ?? "");
	console.log("Domain down, fetching new domain from redirect: " + newDomain.href);
	parser.domain = newDomain.href;

	
	// update database
	await config.updateOne({
		name: "domain"
	}, {
		$set: {
			value: newDomain.href
		}
	});
	console.log("Updated domain in database" + newDomain.href);

	// update all url in database
	const mangas = await dbManga.find({}).toArray() as Manga[];
	for (let i = 0; i < mangas.length; i++) {
		const manga = mangas[i];
		manga.url = manga.url.replace(oldDomain.href, newDomain.href);
		manga.imgUrl = manga.imgUrl.replace(oldDomain.href, newDomain.href);
		await dbManga.updateOne({
			_id: manga._id
		}, {
			$set: {
				url: manga.url
			}
		});
		// log the % of chapters updated
		console.log(`Updated url for ${manga.title} ${i}/${mangas.length} - ${(i / mangas.length * 100).toFixed(2)}%`);		
	}
	const chapters = await dbChapters.find({}).toArray() as dbChapters[];
	for (let i = 0; i < chapters.length; i++) {
		const chapter = chapters[i];
		chapter.url = chapter.url.replace(oldDomain.href, newDomain.href) ;

		// do it for all images
		for (let i = 0; i < chapter.images.length; i++) {
			const image = chapter.images[i];
			chapter.images[i] = image.replace(oldDomain.href, newDomain.href);
		}
			
		await dbChapters.updateOne({
			_id: chapter._id
		}, {
			$set: {
				url: chapter.url,
				images: chapter.images
			}
		});
		// log the % of chapters updated
		console.log(`Updated url for ${chapter.title} ${i}/${chapters.length} - ${(i / chapters.length * 100).toFixed(2)}%`);
	}


}

await checkforNewDomains();
main();
