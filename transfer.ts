import "https://deno.land/x/dotenv@v3.2.2/load.ts";

import { MongoClient, ObjectId } from "https://deno.land/x/mongo@v0.32.0/mod.ts";
import { Chapter, Manga } from "./utils/manga.ts";
const client = new MongoClient();

await client.connect(Deno.env.get("MONGO_URI") ?? "");

const db = client.database("asura");

const dbManga = db.collection("manga");



const newURI = Deno.env.get("NEW_MONGO_URI") ?? '';


const newClient = new MongoClient();

await newClient.connect(newURI);

const newDB = newClient.database("asura");

const newDBManga = newDB.collection("manga");


const mangas = await dbManga.find({}).toArray();

for (const manga of mangas) {
	let m_id = manga._id;
	const newManga = await newDBManga.findOne({
		slug: manga.slug,
	});
	if (!newManga) {
		console.log(`Manga ${manga.slug} does not exist`);
		m_id = await newDBManga.insertOne(manga);
	}

	const chapters = await db.collection("chapters").find({
		mangaId: manga._id,
	}).toArray();

	const updatedChapters = [];

	// check all existing chapters
	const currentChapters = await newDB.collection("chapters").find({
		mangaId: m_id,
	}).toArray();

	for (const chapter of chapters) {
		if (currentChapters.find((c) => c.number === chapter.number)) {
			console.log(`Chapter ${chapter.number} already exists`);
			continue;
		};

		const newChapter = await newDB.collection("chapters").findOne({
			mangaId: m_id,
			number: chapter.number,
		});
		if (!newChapter) {
			console.log(`Chapter ${chapter.number} does not exist`);
			let c_id = await newDB.collection("chapters").insertOne({
				...chapter,
				mangaId: m_id,
			});

			updatedChapters.push({
				number : chapter.number,
				_id: c_id,
			});
		}
	}

	if (updatedChapters.length > 0) {
		await newDBManga.updateOne({
			m_id,
		}, {
			$set: {
				chapters: updatedChapters,
			},
		});
		
		console.log(`Manga ${manga.slug} updated with ${updatedChapters.length} chapters`);
	} else {
		console.log(`Manga ${manga.slug} has no new chapters`);
	
	}


}

const domain = await db.collection("config").findOne({
	name: "domain",
});
console.log(domain);

// check if domain exists
const newDomain = await newDB.collection("config").findOne({
	name: "domain",
});

if (!newDomain) {
	await newDB.collection("config").insertOne(domain as any);
	console.log(await newDB.collection("config").find())
}

