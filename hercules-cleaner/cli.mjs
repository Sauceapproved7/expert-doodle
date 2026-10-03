#!/usr/bin/env node
import {homedir, platform} from "node:os";
import {cleanComputer, getCleanerStatus, runDaemon, scanComputer, startWorkSession, stopWorkSession, restoreCapsule, setProfileSchedule} from "./agent.mjs";
import {installAutostart, uninstallAutostart} from "./autostart.mjs";
import {listRecoveryCapsules} from "./engine.mjs";
import {listenCleanerServer} from "./server.mjs";
import {statePaths} from "./state.mjs";
import {activateCleanerDevice, createDeviceIdentity, loadDeviceCredential, loadDeviceIdentity, saveDeviceCredential, saveDeviceIdentity} from "./device-identity.mjs";

function parse(argv) {
  const args = [...argv];
  const natural = args.join(" ").trim().toLowerCase();
  if (["clean my computer", "clean my laptop", "hercules clean", "clean computer"].includes(natural)) return {command: "clean", rest: []};
  return {command: args.shift() || "status", rest: args};
}

function option(rest, flag, fallback = undefined) {
  const index = rest.indexOf(flag);
  return index >= 0 && rest[index + 1] ? rest[index + 1] : fallback;
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

const {command, rest} = parse(process.argv.slice(2));
const profileId = option(rest, "--profile");
const stateRoot = process.env.HERCULES_CLEANER_STATE_ROOT;
const common = {profileId, stateRoot, home: homedir()};

try {
  if (command === "status") print(await getCleanerStatus(common));
  else if (command === "scan") print(await scanComputer(common));
  else if (command === "clean") {
    const result = await cleanComputer(common);
    print({cleanedFiles: result.cleanedFiles, reclaimedBytes: result.reclaimedBytes, recoveryCapsule: result.capsule.id});
  } else if (command === "session-start") {
    print(await startWorkSession({...common, profileId: profileId || "after-work", label: option(rest, "--label", "Work Session")}));
  } else if (command === "session-stop") {
    const sessionId = option(rest, "--id", rest.find((value) => !value.startsWith("--")));
    print(await stopWorkSession({...common, sessionId, apply: !rest.includes("--preview")}));
  } else if (command === "capsules") print(await listRecoveryCapsules({vaultRoot: statePaths(common).vault}));
  else if (command === "restore") print(await restoreCapsule({...common, capsuleId: option(rest, "--id", rest[0])}));
  else if (command === "dashboard") {
    const instance = await listenCleanerServer(common);
    process.stdout.write(`Hercules Cleaner dashboard: http://${instance.host}:${instance.port}\n`);
  } else if (command === "schedule") {
    const type = option(rest, "--type", rest[0] || "weekly");
    const schedule = {type, enabled: !rest.includes("--off")};
    if (type === "everyNDays") schedule.days = Number(option(rest, "--days", 2));
    if (type === "hourly") schedule.hours = Number(option(rest, "--hours", 1));
    if (type === "lowStorage") schedule.freePercentBelow = Number(option(rest, "--below", 15));
    print(await setProfileSchedule({...common, profileId: profileId || "quick-safe", schedule}));
  } else if (command === "device-init") {
    const paths=statePaths(common);
    const identity=createDeviceIdentity({platform:platform(),version:option(rest,"--version","1.0.0")});
    await saveDeviceIdentity({stateRoot:paths.root,identity});
    print({deviceId:identity.deviceId,platform:identity.platform,version:identity.version,status:"pending_activation"});
  } else if (command === "device-activate") {
    const paths=statePaths(common);
    const identity=await loadDeviceIdentity({stateRoot:paths.root});
    const activationCode=option(rest,"--code",rest.find((value)=>!value.startsWith("--")));
    const endpoint=option(rest,"--endpoint",process.env.HERCULES_CLEANER_DEVICE_ENDPOINT);
    if(!endpoint)throw new Error("HERCULES_CLEANER_DEVICE_ENDPOINT or --endpoint is required");
    const activated=await activateCleanerDevice({endpoint,identity,activationCode});
    await saveDeviceCredential({
      stateRoot:paths.root,
      identity,
      credential:{deviceCredential:activated.deviceCredential,activatedAt:activated.activatedAt},
    });
    print({deviceId:activated.deviceId||identity.deviceId,status:"activated",activatedAt:activated.activatedAt});
  } else if (command === "device-status") {
    const paths=statePaths(common);
    try {
      const saved=await loadDeviceCredential({stateRoot:paths.root});
      print({deviceId:saved.identity.deviceId,platform:saved.identity.platform,version:saved.identity.version,status:"activated",activatedAt:saved.credential.activatedAt});
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      try {
        const pending=await loadDeviceIdentity({stateRoot:paths.root});
        print({deviceId:pending.deviceId,platform:pending.platform,version:pending.version,status:"pending_activation"});
      } catch (pendingError) {
        if (pendingError?.code !== "ENOENT") throw pendingError;
        print({status:"uninitialized"});
      }
    }
  } else if (command === "install-autostart") print(await installAutostart());
  else if (command === "uninstall-autostart") print(await uninstallAutostart());
  else if (command === "daemon") await runDaemon(common);
  else {
    process.stderr.write("Usage: hercules-cleaner [status|scan|clean|dashboard|daemon|schedule|device-init|device-activate|device-status|install-autostart|uninstall-autostart|session-start|session-stop|capsules|restore]\n");
    process.exitCode = 2;
  }
} catch (error) {
  process.stderr.write(`Hercules Cleaner: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
