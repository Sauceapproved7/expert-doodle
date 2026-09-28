import {execFile} from "node:child_process";
import {mkdir, rm, writeFile} from "node:fs/promises";
import {homedir, platform as currentPlatform} from "node:os";
import {dirname, join, resolve} from "node:path";
import {promisify} from "node:util";
import {fileURLToPath} from "node:url";

const execFileAsync = promisify(execFile);

function xmlEscape(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll(""", "&quot;").replaceAll("'", "&apos;");
}

export function createAutostartPlan({
  platform = currentPlatform(),
  home = homedir(),
  nodePath = process.execPath,
  cliPath = fileURLToPath(new URL("./cli.mjs", import.meta.url)),
} = {}) {
  const node = resolve(nodePath);
  const cli = resolve(cliPath);
  if (platform === "win32") {
    const taskName = "SauceApproved Hercules Cleaner";
    const taskCommand = `"${node}" "${cli}" daemon`;
    return {
      platform,
      kind: "windows-scheduled-task",
      install: {command: "schtasks.exe", args: ["/Create", "/F", "/SC", "ONLOGON", "/TN", taskName, "/TR", taskCommand]},
      uninstall: {command: "schtasks.exe", args: ["/Delete", "/F", "/TN", taskName]},
    };
  }
  if (platform === "darwin") {
    const path = join(home, "Library", "LaunchAgents", "com.sauceapproved.hercules-cleaner.plist");
    const content = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n<key>Label</key><string>com.sauceapproved.hercules-cleaner</string>\n<key>ProgramArguments</key><array><string>${xmlEscape(node)}</string><string>${xmlEscape(cli)}</string><string>daemon</string></array>\n<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>\n<key>ProcessType</key><string>Background</string>\n</dict></plist>\n`;
    return {
      platform,
      kind: "launch-agent",
      file: {path, content},
      install: {command: "launchctl", args: ["bootstrap", `gui/${process.getuid?.() ?? 0}`, path]},
      uninstall: {command: "launchctl", args: ["bootout", `gui/${process.getuid?.() ?? 0}`, path]},
    };
  }
  const path = join(home, ".config", "systemd", "user", "hercules-cleaner.service");
  const content = `[Unit]\nDescription=SauceApproved Hercules Cleaner\nAfter=default.target\n\n[Service]\nType=simple\nExecStart=${JSON.stringify(node)} ${JSON.stringify(cli)} daemon\nRestart=on-failure\nRestartSec=5\nNoNewPrivileges=true\nPrivateTmp=true\nProtectSystem=strict\nProtectHome=read-only\nReadWritePaths=${JSON.stringify(join(home, ".hercules-cleaner"))}\n\n[Install]\nWantedBy=default.target\n`;
  return {
    platform,
    kind: "systemd-user-service",
    file: {path, content},
    install: [
      {command: "systemctl", args: ["--user", "daemon-reload"]},
      {command: "systemctl", args: ["--user", "enable", "--now", "hercules-cleaner.service"]},
    ],
    uninstall: [
      {command: "systemctl", args: ["--user", "disable", "--now", "hercules-cleaner.service"]},
      {command: "systemctl", args: ["--user", "daemon-reload"]},
    ],
  };
}

async function runCommand(step) {
  await execFileAsync(step.command, step.args, {windowsHide: true, timeout: 15_000});
}

export async function installAutostart(options = {}) {
  const plan = createAutostartPlan(options);
  if (plan.file) {
    await mkdir(dirname(plan.file.path), {recursive: true});
    await writeFile(plan.file.path, plan.file.content, {mode: 0o600});
  }
  const steps = Array.isArray(plan.install) ? plan.install : [plan.install];
  for (const step of steps) await runCommand(step);
  return {installed: true, kind: plan.kind, file: plan.file?.path ?? null};
}

export async function uninstallAutostart(options = {}) {
  const plan = createAutostartPlan(options);
  const steps = Array.isArray(plan.uninstall) ? plan.uninstall : [plan.uninstall];
  for (const step of steps) await runCommand(step).catch(() => {});
  if (plan.file) await rm(plan.file.path, {force: true});
  return {installed: false, kind: plan.kind};
}
