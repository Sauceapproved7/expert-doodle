import {resolve} from "node:path";
import {createForgeControlServer} from "./control-api.mjs";

const root = resolve(process.env.FORGE_WORKSPACE_ROOT ?? ".hercules-forge");
const port = Number(process.env.PORT ?? 4080);

const server = createForgeControlServer({root});
server.listen(port, "127.0.0.1", () => {
  console.log(JSON.stringify({
    ok: true,
    service: "hercules-forge-control-api",
    address: "127.0.0.1",
    port,
    workspaceRoot: root,
  }));
});
