import {execFile} from "node:child_process";
import {promisify} from "node:util";

const execFileAsync = promisify(execFile);

function parseNvidiaCsv(stdout) {
  return String(stdout || "").trim().split(/\r?\n/).filter(Boolean).map((line, index) => {
    const parts = line.split(",").map(value => value.trim());
    if (parts.length < 3) throw new Error("hardware_probe_nvidia_parse_failed:" + index);
    const memoryMiB = Number(parts[1]);
    if (!Number.isFinite(memoryMiB) || memoryMiB <= 0) throw new Error("hardware_probe_memory_invalid:" + index);
    return {
      index,
      name: parts[0],
      memoryMiB,
      memoryGiB: memoryMiB / 1024,
      driverVersion: parts[2],
    };
  });
}

function parseCudaVersion(stdout) {
  const text = String(stdout || "");
  const release = text.match(/release\s+([0-9]+(?:\.[0-9]+)?)/i);
  return release ? release[1] : null;
}

function meetsVramClass(gpu, minimumGb) {
  if (Number.isFinite(Number(gpu?.memoryMiB))) {
    return Number(gpu.memoryMiB) >= minimumGb * 1000;
  }
  if (Number.isFinite(Number(gpu?.memoryGiB))) {
    return Number(gpu.memoryGiB) >= (minimumGb * 1000 / 1024);
  }
  return false;
}

export async function probeCudaHost({
  exec = execFileAsync,
  minVramGb = 24,
} = {}) {
  const minimum = Number(minVramGb);
  if (!Number.isFinite(minimum) || minimum <= 0) throw new Error("hardware_probe_min_vram_invalid");

  let gpus = [];
  let nvidiaError = null;
  try {
    const {stdout} = await exec("nvidia-smi", [
      "--query-gpu=name,memory.total,driver_version",
      "--format=csv,noheader,nounits",
    ], {timeout:10000});
    gpus = parseNvidiaCsv(stdout);
  } catch (error) {
    nvidiaError = String(error?.message || error);
  }

  let cudaVersion = null;
  let cudaError = null;
  try {
    const {stdout} = await exec("nvcc", ["--version"], {timeout:10000});
    cudaVersion = parseCudaVersion(stdout);
  } catch (error) {
    cudaError = String(error?.message || error);
  }

  const eligible = gpus.filter(gpu => meetsVramClass(gpu, minimum));
  return {
    schema:"sauceapproved.hercules.video-hardware-probe",
    version:1,
    cudaAvailable:gpus.length > 0,
    cudaToolkitVersion:cudaVersion,
    minimumVramGb:minimum,
    gpus,
    eligibleGpuIndexes:eligible.map(gpu => gpu.index),
    eligible:eligible.length > 0,
    diagnostics:{
      nvidiaError,
      cudaError,
    },
  };
}

export function assertWan22Hardware(probe, {minVramGb = 24} = {}) {
  if (!probe || typeof probe !== "object") throw new Error("wan22_hardware_probe_required");
  if (!probe.cudaAvailable) throw new Error("wan22_cuda_gpu_required");
  if (!Array.isArray(probe.gpus) || probe.gpus.length === 0) throw new Error("wan22_gpu_inventory_required");
  const minimum = Number(minVramGb);
  const eligible = probe.gpus.filter(gpu => meetsVramClass(gpu, minimum));
  if (!eligible.length) throw new Error("wan22_minimum_vram_not_met");
  return {
    eligible:true,
    selectedGpu:eligible.sort((a,b) => b.memoryGiB - a.memoryGiB)[0],
    cudaToolkitVersion:probe.cudaToolkitVersion || null,
  };
}
