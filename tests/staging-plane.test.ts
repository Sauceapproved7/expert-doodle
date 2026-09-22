import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const read=(name:string)=>readFileSync(new URL(`../staging-plane/${name}`,import.meta.url),"utf8");

describe("self-hosted staging plane",()=>{
  it("binds services to loopback on an internal network",()=>{
    const compose=read("compose.yml");
    expect(compose).toContain("127.0.0.1:55432:5432");
    expect(compose).toContain("127.0.0.1:38080:8080");
    expect(compose).toContain("internal: true");
  });
  it("enforces synthetic data and row ownership",()=>{
    const schema=read("migrations/001_initialize.sql");
    expect(schema.match(/enable row level security/g)).toHaveLength(3);
    expect(schema).toContain("fixture_owner_insert");
    expect(schema).toContain("check (synthetic)");
  });
  it("contains no production project references",()=>{
    const all=[read("compose.yml"),read("api/server.mjs"),read("migrations/001_initialize.sql"),read("migrations/002_seed_synthetic.sql")].join("\n");
    expect(all).not.toContain("xbwuablxhhwsaoomsoco");
    expect(all).not.toContain("aqlbazybprrouunvardu");
  });
});
