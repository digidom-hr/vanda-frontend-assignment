import { catalogCache } from "@/server/catalog";
import { CATALOG_CACHE_CONTROL, errorResponse, jsonResponse } from "@/server/http";
import { serviceParam, type ServiceRouteContext } from "@/server/route-params";
import type { SeriesListResponse } from "@/services/api-types";

/** The full series catalog of one service. */
export async function GET(_request: Request, context: ServiceRouteContext): Promise<Response> {
  try {
    const service = await serviceParam(context);
    const body: SeriesListResponse = { service, series: await catalogCache.get(service) };
    return jsonResponse(body, CATALOG_CACHE_CONTROL);
  } catch (error) {
    return errorResponse(error, "GET /api/[service]/series");
  }
}
