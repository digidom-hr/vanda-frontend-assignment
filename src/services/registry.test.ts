import { describe, expect, it } from "vitest";
import { findService, getField, getService, isServiceId, SERVICES } from "./registry";

describe("service registry", () => {
  it("has unique service ids", () => {
    const ids = SERVICES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(SERVICES.map((s) => [s.id, s] as const))("%s is internally consistent", (_id, service) => {
    const keys = service.fields.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain(service.defaultField);
    expect(service.frequencies.length).toBeGreaterThan(0);
  });

  it("looks services up by id", () => {
    expect(isServiceId("bravo")).toBe(true);
    expect(isServiceId("delta")).toBe(false);
    expect(getService("charlie").label).toBe("Charlie");
    expect(findService("delta")).toBeUndefined();
  });

  it("looks fields up by key", () => {
    expect(getField(getService("alpha"), "rank")?.inverted).toBe(true);
    expect(getField(getService("alpha"), "nope")).toBeUndefined();
  });
});
