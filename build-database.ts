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
		const mangaData = await dbManga.findOne({
			$or: [{ slug: manga.slug }, { originalSlug: manga.originalSlug }, { title: manga.title }],
		});

		if (mangaData) {
			// check if there's a new chapter in the manga
			if (mangaData.chapters.length < manga.chapters.length) {
				const chap = await manga.parseChapters();
				
				mangaData.chapters = chap.chapters;
				// update the manga in the database
				// update updated_on
				mangaData.Updated_On = new Date();

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
}

main();
