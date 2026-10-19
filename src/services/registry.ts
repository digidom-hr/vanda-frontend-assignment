import { alphaMeta } from "./alpha/meta";
import { bravoMeta } from "./bravo/meta";
import { charlieMeta } from "./charlie/meta";
import type { FieldMeta, ServiceMeta } from "./types";

/**
 * Every data service the app knows about, in navigation order. Adding a
 * service means adding its folder and one entry here (plus its adapter in
 * `src/server/adapters.ts`, which the compiler will demand).
 */
export const SERVICES = [alphaMeta, bravoMeta, charlieMeta] as const satisfies readonly ServiceMeta[];

export type ServiceId = (typeof SERVICES)[number]["id"];

const byId = new Map<string, ServiceMeta>(SERVICES.map((s) => [s.id, s]));

export function isServiceId(value: string): value is ServiceId {
  return byId.has(value);
}

export function getService(id: ServiceId): ServiceMeta {
  return byId.get(id) as ServiceMeta;
}

export function findService(id: string): ServiceMeta | undefined {
  return byId.get(id);
}

export function getField(service: ServiceMeta, key: string): FieldMeta | undefined {
  return service.fields.find((f) => f.key === key);
}
