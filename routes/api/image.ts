import { HandlerContext } from "$fresh/server.ts";
import { MongoClient, ObjectId } from "https://deno.land/x/mongo@v0.31.0/mod.ts";
const client = new MongoClient();

await client.connect(Deno.env.get("MONGO_URI") as string);
const db = client.database("asura");
const config = db.collection("config");

const domain = await config.findOne({
	name: "domain",
}) as { value: string };
export const handler = async (_req: Request, _ctx: HandlerContext): Promise<Response> => {

	// get query params
	const params = new URL(_req.url).searchParams;
	// check if path contains 2 url  example : https://asuratoon.com///unsafe/fit-in/720x936/https://asuratoon.com/wp-content/uploads/2023/11/Regressing-with-the-Kings-Power.jpg
	// remove the first url and get the second url
	let path = (params.get("path") ?? "") // remove everything infront of the https
		.replace(/.*https/, "https") // remove everything after the .jpg
		.replace(domain.value, "")
	


	const image = await fetch(`${domain.value}${path}`).then((res) => res.arrayBuffer());

	return new Response(image, {
		headers: {
			"content-type": "image/jpeg",
		},
	});

};
