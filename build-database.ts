import "https://deno.land/x/dotenv@v3.2.2/load.ts";
import AsuraParser from "./parser/sites/asura.ts";

import { Chapter, Manga } from "./utils/manga.ts";
import { ObjectId } from "../../../../AppData/Local/deno/npm/registry.npmjs.org/bson/6.4.0/bson.d.ts";

import { MongoClient } from "npm:mongodb";
const client = await (new MongoClient(Deno.env.get("MONGO_URI") ?? "")).connect();

const db = client.db("asura");

const dbManga = db.collection("manga");

interface dbChapters {
	_id: string;
	mangaId: string;
	images: Array<string>;
	title: string;
	url: string;
	date: string;
	number: number;
}

const dbChapters = db.collection("chapters");

// print current directory

const parser = new AsuraParser();

async function main() {
	console.log(parser.domain);

	for await (const manga of parser.getMangaList()) {
		console.log(manga)
		// check if manga is already in the database
		const mangaData = await dbManga
			.find({
				$or: [{ slug: manga.slug }, { originalSlug: manga.originalSlug }, { title: manga.title }],
				// join chapters array
			})
			.toArray();


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
				const MostChapters = (await dbChapters
          .find({
            mangaId: mangaData[0]._id,
          })
          .toArray()) as unknown as dbChapters[];

				// find the one with the most chapters and delete the rest
				let mostChapters = mangaData[0] as Manga;
				for (let i = 0; i < mangaData.length; i++) {
					const chapters = (await dbChapters
            .find({
              mangaId: mangaData[i]._id,
            })
            .toArray()) as unknown as dbChapters[];

					if (chapters.length > MostChapters.length) {
						mostChapters = MostChapters as unknown as Manga;
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
				console.log(`Found new chapters for ${manga.title}`);
				console.log(mangaData[0].chapters.length, manga.chapters.length);

				// get all chapters in the database
				const Chapters = (await dbChapters
          .find({
            mangaId: mangaData[0]._id,
          })
          .toArray()) as unknown as dbChapters[];
				// double check if all chapters are in the database
				if (Chapters.length > mangaData[0].chapters.length) {
					// check if all chapters are in the mangaData[0].chapters
					mangaData[0].chapters = Chapters.map((chapter) => {
						return {
							_id: chapter._id,
							number: chapter.number,
						};
					});
					await dbManga.updateOne(
						{
							_id: mangaData[0]._id,
						},
						{
							$set: {
								chapters: mangaData[0].chapters,
							},
						},
					);
					console.log(`Updated ${manga.title} with ${Chapters.length} missing chapters`);
					continue;
				}

				const chap = await manga.parseChapters();
				// check if all chapters urls are newer than the ones in the database if not
				const oldChapters = Chapters.filter((chapter) => {
					const newChapter = chap.chapters.find((c: dbChapters) => c.url === chapter.url);
					if (newChapter) {
						return false;
					}
					return true;
				});
				const newChapters = chap.chapters.filter((chapter: Chapter) => {
					const newChapter = Chapters.find((c: dbChapters) => c.number === chapter.number && c.url === chapter.url);
					if (newChapter) {
						return false;
					}
					return true;
				});

				// delete old chapters
				if (oldChapters.length > 0) {
					await dbChapters.deleteMany({
						_id: {
							$in: oldChapters.map((chapter) => chapter._id) as unknown as ObjectId[],
						},
					});
					console.log(`Deleted ${oldChapters.length} old chapters for ${manga.title}`);
				}

				if (newChapters.length > 0) {
					console.log(`Found ${newChapters.length} new chapters for ${manga.title}`);
					const list = await dbChapters.insertMany(
						newChapters.map((chapter: Chapter) => {
							return {
								mangaId: mangaData[0]._id,
								images: chapter.pages,
								title: chapter.title,
								url: chapter.url,
								date: chapter.date,
								number: parseFloat(chapter.title.split(" ")[1]),
							};
						}),
					);
					console.log(`Inserted ${newChapters.length} new chapters for ${manga.title}`);

					// delete old chapters
					delete mangaData[0].chapters;
					mangaData[0].chapters = await dbChapters
						.find({
							mangaId: mangaData[0]._id,
							_id: {
								$in: list.insertedIds as unknown as ObjectId[],
							},
						})
						.toArray()
						.then((chapters) => {
							return chapters.map((chapter) => {
								return {
									_id: chapter._id,
									number: chapter.number,
								};
							});
						});
				}

				// mangaData[0] the manga in the database
				// update updated_on
				mangaData[0].Updated_On = new Date();

				// delete old chapters

				await dbManga.updateOne(
					{
						_id: mangaData[0]._id,
					},
					{
						$set: {
							...mangaData[0],
						},
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
			});
			const chapt: Array<{ number: number }> = [];

			const list = await dbChapters.insertMany(
				chap.chapters.map((chapter: Chapter) => {
					const c_chapter = {
						number: parseFloat(chapter.title.split(" ")[1]),
					};
					chapt.push(c_chapter);

					return {
						mangaId: mangaDataID,
						images: chapter.pages,
						title: chapter.title,
						url: chapter.url,
						date: chapter.date,
						number: parseFloat(chapter.title.split(" ")[1]),
					};
				}),
			);

			// // delete old chapters
			manga.chapters = chapt.map((chapter) => {
				return {
					number: chapter.number,
					_id: list.insertedIds[chapter.number - 1],
				};
				// deno-lint-ignore no-explicit-any
			}) as any;

			// insert manga into database

			await dbManga.updateOne(
				{
					_id: mangaDataID,
				},
				{
					$set: {
						chapters: manga.chapters,
					},
				},
			);
			console.log(`Inserted ${manga.title}`);
			console.log(`Inserted ${manga.chapters.length} new chapters for ${manga.title}`);
		}
	}

	console.log("Finished updating database");
}

async function CleanDatabase() {
	// make sure theirs no duplicates
	const mangas = (await dbManga.find({}).toArray()) as Manga[];
	const firstFound = new Map<string, dbChapters | Manga>();
	const toDelete = new Array<string>();
	for (let i = 0; i < mangas.length; i++) {
		const manga = mangas[i];
		if (firstFound.has(manga.slug)) {
			console.log("Found duplicate for " + manga.title);
			toDelete.push(manga._id.toString());
			console.log("Deleted " + manga.title);
		} else {
			firstFound.set(manga.slug, manga);
		}
	}
	await dbManga.deleteMany({
		_id: {
			$in: toDelete as unknown as ObjectId[],
		},
	});

	// clear firstFound
	firstFound.clear();
	toDelete.length = 0;
	console.log(firstFound);
	const chapters = (await dbChapters.find({}).toArray()) as unknown as dbChapters[];
	for (let i = 0; i < chapters.length; i++) {
		const chapter = chapters[i];
		if (firstFound.has(chapter.mangaId + chapter.number)) {
			// check if title is the same
			// remove white space more than 1 &
			const firstTitle = chapter.title.replace(/\s\s+/g, " ").trim();
			const secondTitle = (firstFound.get(chapter.mangaId + chapter.number) as dbChapters).title.replace(/\s\s+/g, " ").trim();

			if (firstTitle == secondTitle) {
				console.log("Found duplicate for " + chapter.mangaId + " | " + chapter.number);
				toDelete.push(chapter._id);
				console.log("Deleted " + chapter.title);
				continue;
			} else {
				// parse chapter title for number
				const firstNumber = parseFloat(firstTitle.split(" ")[1]);
				const secondNumber = parseFloat(secondTitle.split(" ")[1]);

				if (firstNumber == secondNumber) {
					console.log("Found duplicate for " + chapter.mangaId + " | " + chapter.number);
					toDelete.push(chapter._id);
					console.log("Deleted " + chapter.title);
					continue;
				} else if (!isNaN(firstNumber) || !isNaN(secondNumber)) {
					console.log("Found duplicate for " + chapter.mangaId + " | " + chapter.number);
					console.log("But the title is different");
					console.log("Updating both numbers for float");
					console.log("First number: " + firstNumber);
					console.log("Second number: " + secondNumber);
					await dbChapters.updateOne(
						{
							_id: chapter._id as unknown as ObjectId,
						},
						{
							$set: {
								number: firstNumber,
							},
						},
					);
					await dbChapters.updateOne(
						{
							_id: (firstFound.get(chapter.mangaId + chapter.number) as dbChapters)._id as unknown as ObjectId,
						},
						{
							$set: {
								number: secondNumber,
							},
						},
					);
				}
			}
		} else {
			firstFound.set(chapter.mangaId + chapter.number, chapter);
		}
	}
	await dbChapters.deleteMany({
		_id: {
			$in: toDelete as unknown as ObjectId[],
		},
	});
}

async function checkforNewDomains() {
	const config = db.collection("config");

	const domain = await config.findOne({
		name: "domain",
	});

	if (domain) {
		parser.domain = domain.value;
	}

	const oldDomain = new URL(parser.domain);
	// fetch old domain and check if it's still up do not follow redirects
	const response = await fetch(oldDomain, {
		method: "GET",
		redirect: "manual",
	});

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
	console.log("Updated domain in database" + newDomain.href);

	// update all url in database

	const mangas = (await dbManga
		.find({
			$or: [
				{
					url: {
						$not : {
							$regex: newDomain.href,
						},
					},
				},
				{
					imgUrl: {
						$not : {
							$regex: newDomain.href,
						},
					},
				},
			],
		})
		.toArray()) as Manga[];
	for (let i = 0; i < mangas.length; i++) {
		const manga = mangas[i];
		// parse old domain from url
		const oldDomainFromUrl = new URL(manga.url);
		const oldDomainFromIMGUrl = new URL(manga.imgUrl);
		// replace old domain with new domain
		manga.imgUrl = manga.imgUrl.replace(oldDomainFromIMGUrl.origin, newDomain.origin);
		manga.url = manga.url.replace(oldDomainFromUrl.origin, newDomain.origin);

		await dbManga.updateOne(
			{
				_id: manga._id,
			},
			{
				$set: {
					url: manga.url,
					imgUrl: manga.imgUrl,
				},
			},
		);
		// log the % of chapters updated
		console.log(`Updated url for ${manga.title} ${i}/${mangas.length} - ${((i / mangas.length) * 100).toFixed(2)}%`);
	}

	const chapters = (await dbChapters.find({
    $or: [
      {
        url: {
          $not: {
            $regex: newDomain.href,
          }
        },
      },
      {
        images: {
          $not: {
            $regex: newDomain.href,
          }
        },
      },
    ]
  }).toArray()) as unknown as dbChapters[];
	for (let i = 0; i < chapters.length; i++) {
		const chapter = chapters[i];
		const oldDomain = new URL(chapter.url);
		chapter.url = chapter.url.replace(oldDomain.origin, newDomain.origin);

		// do it for all images
		for (let i = 0; i < chapter.images.length; i++) {
			const image = chapter.images[i];
			const oldDomain = new URL(image);
			chapter.images[i] = image.replace(oldDomain.origin, newDomain.origin);
		}

		await dbChapters.updateOne(
			{
				_id: chapter._id as unknown as ObjectId,
			},
			{
				$set: {
					url: chapter.url,
					images: chapter.images,
				},
			},
		);
		// log the % of chapters updated
		console.log(`Updated url for ${chapter.title} ${i}/${chapters.length} - ${((i / chapters.length) * 100).toFixed(2)}%`);
	}

	await config.updateOne(
		{
			name: "domain",
		},
		{
			$set: {
				value: newDomain.href,
			},
		},
	);
}

await checkforNewDomains();
await main();
await CleanDatabase();
