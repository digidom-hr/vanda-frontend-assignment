import { errorResponse, CATALOG_CACHE_CONTROL, jsonResponse } from "@/server/http";
import { upstreamGetAllPages } from "@/server/upstream";
import type { CharlieLatestResponse } from "@/services/api-types";
import { parseCharlieLatest } from "@/services/charlie/adapter";

/** Latest value and signal for every charlie series. */
export async function GET(request: Request): Promise<Response> {
  try {
    const items = await upstreamGetAllPages("charlie/latest", {}, { signal: request.signal });
    const body: CharlieLatestResponse = { latest: parseCharlieLatest(items) };
    return jsonResponse(body, CATALOG_CACHE_CONTROL);
  } catch (error) {
    return errorResponse(error, "GET /api/charlie/latest");
  }
}
