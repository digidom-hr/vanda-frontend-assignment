import { catalogCache } from "@/server/catalog";
import { DATA_CACHE_CONTROL, errorResponse, jsonResponse } from "@/server/http";
import { serviceParam, type ServiceRouteContext } from "@/server/route-params";
import { getTimeseries } from "@/server/timeseries";

/**
 * Columnar timeseries for one or more series of a service.
 * Query: `ids` (comma-separated, required), `frequency`, `from`, `to` (YYYY-MM-DD), `fields` (comma-separated).
 */
export async function GET(request: Request, context: ServiceRouteContext): Promise<Response> {
  try {
    const service = await serviceParam(context);
    const params = new URL(request.url).searchParams;
    // request.signal aborts upstream reads when the browser cancels or disconnects.
    const body = await getTimeseries(service, params, catalogCache, request.signal);
    return jsonResponse(body, DATA_CACHE_CONTROL);
  } catch (error) {
    return errorResponse(error, "GET /api/[service]/timeseries");
  }
}
