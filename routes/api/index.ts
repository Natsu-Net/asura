

import { FreshContext } from "$fresh/server.ts";
import { ServerFetcher } from "../../utils/fetcher.ts";

export const handler = async (_req: Request, _ctx: FreshContext): Promise<Response> => {
	const result = await ServerFetcher(_req.url);
	return new Response(JSON.stringify(result));
};
