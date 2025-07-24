/// <reference lib="deno.unstable" />
import { HandlerContext } from "$fresh/server.ts";
import { openKv } from "../../utils/kv.ts";

export const handler = async (_req: Request, _ctx: HandlerContext): Promise<Response> => {
	const kv = await openKv();
	
	// Get domain from KV store
	const domainConfig = await kv.get(["config", "domain"]);
	const domain = domainConfig.value as string || "https://asuracomics.com";

	// get query params
	const params = new URL(_req.url).searchParams;

	// remove the first url and get the second url
	const path = (params.get("path") ?? "") // remove everything infront of the https
		.replace(/.*https/, "https") // remove everything after the .jpg
		.replace(domain, "")
	
	// fetch the image
	const image = await fetch(`${domain}${path}`).then((res) => res.arrayBuffer());

	return new Response(image, {
		headers: {
			"content-type": "image/jpeg",
		},
	});
};
