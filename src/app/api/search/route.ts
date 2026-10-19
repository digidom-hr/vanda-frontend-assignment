import { catalogCache } from "@/server/catalog";
import { CATALOG_CACHE_CONTROL, errorResponse, jsonResponse } from "@/server/http";
import { searchAllServices } from "@/server/search";

/** Searches series across every service. Query: `q`, `limit` (1–50, default 20). */
export async function GET(request: Request): Promise<Response> {
  try {
    const body = await searchAllServices(new URL(request.url).searchParams, catalogCache);
    // Partial results must not be cached as if they were complete.
    const partial = body.services.some((s) => s.status !== "ok");
    return jsonResponse(body, partial ? "no-store" : CATALOG_CACHE_CONTROL);
  } catch (error) {
    return errorResponse(error, "GET /api/search");
  }
}
