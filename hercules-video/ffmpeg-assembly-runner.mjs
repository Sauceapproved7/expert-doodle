import {spawn} from "node:child_process";
import {stat, readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {createHash} from "node:crypto";
import {validateAssemblyPlan, createAssemblyEvidence} from "./assembly-core.mjs";

function localPath(uri) {
  if (!String(uri || "").startsWith("file://")) throw new Error("assembly_local_file_required");
  return fileURLToPath(uri);
}

async function assertFile(filePath, code) {
  const info = await stat(filePath).catch(() => null);
  if (!info?.isFile()) throw new Error(code);
  return info;
}

async function sha256File(filePath) {
  const bytes = await readFile(filePath);
  return createHash("sha256").update(bytes).digest("hex");
}

function escapeDrawtext(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/,/g, "\\,")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

export function compileFfmpegAssembly(plan,{outputPath,ffmpegBinary="ffmpeg"}={}) {
  validateAssemblyPlan(plan);
  if (!path.isAbsolute(String(outputPath || ""))) throw new Error("assembly_output_absolute_path_required");

  const args=["-y","-hide_banner","-loglevel","error"];
  for (const clip of plan.clips) args.push("-i",localPath(clip.uri));
  for (const track of plan.audioTracks) args.push("-i",localPath(track.uri));

  const filters=[];
  const videoInputs=[];
  plan.clips.forEach((_,index)=>{
    filters.push(`[${index}:v:0]setpts=PTS-STARTPTS[v${index}]`);
    videoInputs.push(`[v${index}]`);
  });
  filters.push(`${videoInputs.join("")}concat=n=${plan.clips.length}:v=1:a=0[vcat]`);

  let videoLabel="vcat";
  if (plan.policy.captionBurnIn && plan.captions.length) {
    let current="[vcat]";
    plan.captions.forEach((caption,index)=>{
      const label=`vcap${index}`;
      filters.push(
        `${current}drawtext=text='${escapeDrawtext(caption.text)}':x=(w-text_w)/2:y=h-(text_h*2):enable='between(t,${caption.startSeconds},${caption.endSeconds})'[${label}]`
      );
      current=`[${label}]`;
      videoLabel=label;
    });
  }

  const audioBase=plan.clips.length;
  const narration=[];
  const beds=[];
  plan.audioTracks.forEach((track,index)=>{
    const label=`a${index}`;
    const delayMs=Math.round(track.startSeconds*1000);
    filters.push(
      `[${audioBase+index}:a:0]atrim=0:${track.durationSeconds},asetpts=PTS-STARTPTS,adelay=${delayMs}|${delayMs},volume=${track.gainDb}dB[${label}]`
    );
    if (track.kind==="narration") narration.push(label);
    else beds.push(label);
  });

  let audioLabel=null;
  if (plan.audioTracks.length) {
    if (plan.policy.ducking.enabled && narration.length && beds.length) {
      filters.push(`${beds.map(label=>`[${label}]`).join("")}amix=inputs=${beds.length}:normalize=0[bedmix]`);
      filters.push(`${narration.map(label=>`[${label}]`).join("")}amix=inputs=${narration.length}:normalize=0[narrmix]`);
      filters.push(
        `[bedmix][narrmix]sidechaincompress=threshold=0.03:ratio=8:attack=${plan.policy.ducking.attackMs}:release=${plan.policy.ducking.releaseMs}[ducked]`
      );
      filters.push(
        `[ducked][narrmix]amix=inputs=2:normalize=0,loudnorm=I=${plan.policy.targetLufs}:TP=${plan.policy.truePeakDbtp}:LRA=${plan.policy.loudnessRange}[aout]`
      );
      audioLabel="aout";
    } else {
      const labels=[...beds,...narration];
      filters.push(
        `${labels.map(label=>`[${label}]`).join("")}amix=inputs=${labels.length}:normalize=0,loudnorm=I=${plan.policy.targetLufs}:TP=${plan.policy.truePeakDbtp}:LRA=${plan.policy.loudnessRange}[aout]`
      );
      audioLabel="aout";
    }
  }

  args.push("-filter_complex",filters.join(";"),"-map",`[${videoLabel}]`);
  if (audioLabel) args.push("-map",`[${audioLabel}]`);
  args.push("-c:v","libx264","-pix_fmt","yuv420p");
  if (audioLabel) args.push("-c:a","aac","-b:a","192k");
  args.push("-movflags","+faststart",outputPath);
  return {command:String(ffmpegBinary),args};
}

export async function runFfmpegAssembly(plan,{
  outputPath,
  ffmpegBinary="ffmpeg",
  timeoutMs=20*60*1000,
  spawnImpl=spawn,
}={}) {
  validateAssemblyPlan(plan);
  for (const clip of plan.clips) await assertFile(localPath(clip.uri),"assembly_clip_missing");
  for (const track of plan.audioTracks) await assertFile(localPath(track.uri),"assembly_audio_missing");

  const compiled=compileFfmpegAssembly(plan,{outputPath,ffmpegBinary});
  await new Promise((resolve,reject)=>{
    const child=spawnImpl(compiled.command,compiled.args,{stdio:["ignore","pipe","pipe"],shell:false});
    let stderr="";
    let settled=false;
    const timer=setTimeout(()=>{
      if (settled) return;
      settled=true;
      child.kill("SIGTERM");
      const error=new Error("assembly_timeout");
      error.code="assembly_timeout";
      reject(error);
    },timeoutMs);
    child.stderr?.on("data",chunk=>{stderr+=chunk.toString();});
    child.once("error",error=>{
      if (settled) return;
      settled=true;
      clearTimeout(timer);
      reject(error);
    });
    child.once("close",code=>{
      if (settled) return;
      settled=true;
      clearTimeout(timer);
      if (code!==0) {
        const error=new Error("assembly_failed:"+stderr.slice(-1000));
        error.code="assembly_failed";
        reject(error);
      } else resolve();
    });
  });

  const info=await assertFile(outputPath,"assembly_output_missing");
  const output={
    uri:pathToFileURL(outputPath).href,
    mimeType:"video/mp4",
    sizeBytes:info.size,
    sha256:await sha256File(outputPath),
  };
  return {output,evidence:createAssemblyEvidence({plan,output})};
}
