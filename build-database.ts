import "https://deno.land/x/dotenv@v3.2.2/load.ts";
import AsuraParser from "./parser/sites/asura.ts";

import { MongoClient } from "https://deno.land/x/mongo@v0.31.2/mod.ts";
const client = new MongoClient();

await client.connect(Deno.env.get("MONGO_URI") ?? "");

const db = client.database("asura");

const dbManga = db.collection("manga");

// print current directory

const parser = new AsuraParser();

async function main() {
	for await (const manga of parser.getMangaList()) {
		// check if manga is already in the database
		const mangaData = await dbManga.find({
			$or: [{ slug: manga.slug }, { originalSlug: manga.originalSlug }, { title: manga.title }],
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
				// find the one with the most chapters and delete the rest
				let mostChapters = mangaData[0];
				for (let i = 0; i < mangaData.length; i++) {
					if (mangaData[i].chapters.length > mostChapters.chapters.length) {
						mostChapters = mangaData[i];
						console.log("Found most chapters for " + mangaData[i].title + " with " + mangaData[i].chapters.length + " chapters" + " id: " + mangaData[i]._id);
					}
				}

				for (let i = 0; i < mangaData.length; i++) {
					if (mangaData[i]._id !== mostChapters._id) {
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
				
				mangaData[0].chapters = chap.chapters;
				// mangaData[0] the manga in the database
				// update updated_on
				mangaData[0].Updated_On = new Date();

				// parse chapters


				await dbManga.updateOne(
					{
						$or: [{ slug: manga.slug }, { originalSlug: manga.originalSlug }],
					},
					{
						$set: {
							...mangaData
						}
					},
				);
				console.log(`Updated ${manga.title}`);
			}

		} else {
			const chap = await manga.parseChapters();
			manga.chapters = chap.chapters;
			// insert manga into database
			
			await dbManga.insertOne(manga);
			console.log(`Inserted ${manga.title}`);
		}
		
	}

	console.log("Finished updating database");

	// updating all url domains from asura.gg to asura.nacm.xyz/
	// const mangaList = await dbManga.find().toArray();
	// for (let i = 0; i < mangaList.length; i++) {
	// 	const manga = mangaList[i];
	// 	if (manga.url.includes("asura.gg") || manga.imgUrl.includes("asura.gg")) {
	// 		manga.url = manga.url.replace("asura.gg", "asura.nacm.xyz");
	// 		manga.imgUrl = manga.imgUrl.replace("asura.gg", "asura.nacm.xyz");
	// 		// images
	// 		for (let j = 0; j < manga.chapters.length; j++) {
	// 			const chapter = manga.chapters[j];
	// 			chapter.url = chapter.url.replace("asura.gg", "asura.nacm.xyz");
	// 			for (let k = 0; k < chapter.pages.length; k++) {
	// 				const page = chapter.pages[k];
	// 				chapter.pages[k] = page.replace("asura.gg", "asura.nacm.xyz");
	// 			}
	// 		}


	// 		await dbManga.updateOne(
	// 			{
	// 				_id: manga._id,
	// 			},
	// 			{
	// 				$set: {
	// 					url: manga.url,
	// 					imgUrl: manga.imgUrl,
	// 					chapters: manga.chapters
	// 				}
	// 			},
	// 		);

	// 		console.log(`Updated ${manga.title}`);
			
	// 	}
	// }
	
	
}

main();
