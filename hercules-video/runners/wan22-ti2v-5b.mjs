import {spawn} from "node:child_process";
import {stat, readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {createHash} from "node:crypto";
import {HerculesLocalVideoRunner} from "../local-runner.mjs";
import {assertWan22Hardware} from "../hardware-probe.mjs";

const SUPPORTED_SIZES = Object.freeze({
  "16:9":"1280*704",
  "9:16":"704*1280",
});

function ensureAbsoluteLocalPath(value, name) {
  const raw = String(value || "");
  if (!raw || !path.isAbsolute(raw)) throw new Error(name);
  return path.normalize(raw);
}

async function assertFile(pathname, name) {
  let info;
  try {
    info = await stat(pathname);
  } catch {
    throw new Error(name);
  }
  if (!info.isFile()) throw new Error(name);
  return info;
}

async function assertDirectory(pathname, name) {
  let info;
  try {
    info = await stat(pathname);
  } catch {
    throw new Error(name);
  }
  if (!info.isDirectory()) throw new Error(name);
  return info;
}

function frameCountFor(durationSeconds, fps = 24) {
  const target = Number(durationSeconds) * fps;
  if (!Number.isFinite(target) || target <= 0) throw new Error("wan22_duration_invalid");
  const n = Math.max(1, Math.round((target - 1) / 4));
  return 4 * n + 1;
}

function firstLocalImageReference(request) {
  const refs = Array.isArray(request.references) ? request.references : [];
  const image = refs.find(ref => ref.kind === "image");
  if (!image) return null;
  const uri = String(image.uri || "");
  if (!uri.startsWith("file://")) throw new Error("wan22_local_image_reference_required");
  return fileURLToPath(uri);
}

async function sha256File(filePath) {
  const bytes = await readFile(filePath);
  return createHash("sha256").update(bytes).digest("hex");
}

function runProcess(command, args, {cwd, env, timeoutMs, spawnImpl = spawn}) {
  return new Promise((resolve, reject) => {
    const child = spawnImpl(command, args, {
      cwd,
      env:{...process.env, ...env},
      stdio:["ignore","pipe","pipe"],
      shell:false,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      child.kill("SIGTERM");
      const error = new Error("wan22_render_timeout");
      error.code = "wan22_render_timeout";
      error.retryable = true;
      settled = true;
      reject(error);
    }, timeoutMs);

    child.stdout?.on("data", chunk => { stdout += chunk.toString(); });
    child.stderr?.on("data", chunk => { stderr += chunk.toString(); });

    child.once("error", error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", code => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        const error = new Error("wan22_render_failed:" + String(stderr || stdout).slice(-1000));
        error.code = "wan22_render_failed";
        error.retryable = false;
        reject(error);
        return;
      }
      resolve({stdout,stderr});
    });
  });
}

export class Wan22Ti2v5bRunner extends HerculesLocalVideoRunner {
  constructor({
    wanRepoDir,
    checkpointDir,
    python = "python",
    hardwareProbe,
    upstreamCommit,
    checkpointSha256 = null,
    outputDir,
    timeoutMs = 30 * 60 * 1000,
    spawnImpl = spawn,
  }) {
    super({
      id:"wan22-ti2v-5b",
      label:"Wan2.2 TI2V-5B",
      modelFamily:"Wan2.2",
      nativeAudio:false,
    });
    this.wanRepoDir = ensureAbsoluteLocalPath(wanRepoDir, "wan22_repo_dir_required");
    this.checkpointDir = ensureAbsoluteLocalPath(checkpointDir, "wan22_checkpoint_dir_required");
    this.outputDir = ensureAbsoluteLocalPath(outputDir, "wan22_output_dir_required");
    this.python = String(python || "python");
    this.hardwareProbe = hardwareProbe;
    this.upstreamCommit = String(upstreamCommit || "").trim();
    if (!/^[a-f0-9]{40}$/i.test(this.upstreamCommit)) throw new Error("wan22_upstream_commit_required");
    this.checkpointSha256 = String(checkpointSha256 || "").toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(this.checkpointSha256)) throw new Error("wan22_checkpoint_sha256_required");
    this.timeoutMs = Number(timeoutMs);
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs <= 0) throw new Error("wan22_timeout_invalid");
    this.spawnImpl = spawnImpl;
  }

  async health() {
    const hardware = assertWan22Hardware(this.hardwareProbe, {minVramGb:24});
    await assertDirectory(this.wanRepoDir, "wan22_repo_missing");
    await assertDirectory(this.checkpointDir, "wan22_checkpoint_missing");
    await assertDirectory(this.outputDir, "wan22_output_dir_missing");
    await assertFile(path.join(this.wanRepoDir, "generate.py"), "wan22_generate_py_missing");
    return {
      ok:true,
      runnerId:this.descriptor.id,
      modelFamily:this.descriptor.modelFamily,
      upstreamCommit:this.upstreamCommit,
      checkpointSha256:this.checkpointSha256,
      hardware,
    };
  }

  async estimate(request) {
    const frames = frameCountFor(request.shot.durationSeconds, 24);
    return {
      supported:Boolean(SUPPORTED_SIZES[request.shot.aspectRatio]),
      fps:24,
      frameCount:frames,
      approximateDurationSeconds:frames / 24,
      nativeAudio:false,
    };
  }

  async render(request) {
    await this.health();
    if (request.shot.requiresAudio && request.shot.audioStrategy === "native") {
      const error = new Error("wan22_native_audio_not_supported");
      error.code = "wan22_native_audio_not_supported";
      error.retryable = false;
      throw error;
    }

    const size = SUPPORTED_SIZES[request.shot.aspectRatio];
    if (!size) throw new Error("wan22_aspect_ratio_unsupported");

    const frameNum = frameCountFor(request.shot.durationSeconds, 24);
    const safeName = String(request.shot.id).replace(/[^a-zA-Z0-9._-]/g, "_");
    const outputPath = path.join(this.outputDir, safeName + "-" + request.requestFingerprint.slice(0,12) + ".mp4");
    const args = [
      "generate.py",
      "--task","ti2v-5B",
      "--size",size,
      "--frame_num",String(frameNum),
      "--ckpt_dir",this.checkpointDir,
      "--offload_model","True",
      "--convert_model_dtype",
      "--t5_cpu",
      "--save_file",outputPath,
      "--prompt",request.shot.prompt,
    ];

    if (request.seed != null) args.push("--base_seed",String(request.seed));
    const imagePath = firstLocalImageReference(request);
    if (imagePath) {
      await assertFile(imagePath, "wan22_image_reference_missing");
      args.push("--image",imagePath);
    }

    await runProcess(this.python,args,{
      cwd:this.wanRepoDir,
      timeoutMs:this.timeoutMs,
      spawnImpl:this.spawnImpl,
    });

    const info = await assertFile(outputPath, "wan22_output_missing");
    const artifactSha = await sha256File(outputPath);
    return {
      artifact:{
        uri:pathToFileURL(outputPath).href,
        mimeType:"video/mp4",
        sizeBytes:info.size,
        sha256:artifactSha,
        durationSeconds:frameNum / 24,
        metadata:{
          runnerId:this.descriptor.id,
          modelFamily:this.descriptor.modelFamily,
          upstreamCommit:this.upstreamCommit,
          checkpointSha256:this.checkpointSha256,
          task:"ti2v-5B",
          size,
          fps:24,
          frameCount:frameNum,
          nativeAudio:false,
        },
      },
    };
  }
}
