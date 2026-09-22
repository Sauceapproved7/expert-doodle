import {describe,expect,it} from "vitest";
import {guardTarget,percentile,profiles} from "../scripts/performance-harness.mjs";

describe("fixture performance harness",()=>{
  it("accepts only loopback read-only benchmark paths",()=>{
    expect(guardTarget("http://127.0.0.1:3000/api/health").pathname).toBe("/api/health");
    expect(()=>guardTarget("https://example.com/api/health")).toThrow("non_loopback");
    expect(()=>guardTarget("http://127.0.0.1:3000/api/deploy")).toThrow("rejected_path");
    expect(()=>guardTarget("http://127.0.0.1:3000/api/health?secret=x")).toThrow("sensitive_or_dynamic");
  });

  it("computes nearest-rank percentiles",()=>{
    expect(percentile([1,2,3,4],50)).toBe(2);
    expect(percentile([1,2,3,4],95)).toBe(4);
  });

  it("ships load, stress, spike, and soak profiles",()=>{
    expect(Object.keys(profiles)).toEqual(["smoke","load","stress","spike","soak"]);
  });
});
