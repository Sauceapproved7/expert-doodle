import hashlib
import json
import os
import tempfile

import gradio as gr
import spaces
import torch
from diffusers import AutoencoderKLWan, WanPipeline
from diffusers.utils import export_to_video

MODEL_ID = os.getenv("HERCULES_VIDEO_MODEL", "Wan-AI/Wan2.2-TI2V-5B-Diffusers")
MODEL_REF = MODEL_ID
SUPPORTED_RATIOS = {
    "16:9": (704, 1280),
    "9:16": (1280, 704),
}

vae = AutoencoderKLWan.from_pretrained(
    MODEL_ID,
    subfolder="vae",
    torch_dtype=torch.float32,
)
pipe = WanPipeline.from_pretrained(
    MODEL_ID,
    vae=vae,
    torch_dtype=torch.bfloat16,
)
pipe.to("cuda")


def _validated_request(payload_json: str) -> dict:
    try:
        payload = json.loads(payload_json)
    except Exception as exc:
        raise gr.Error("Invalid Hercules render request JSON.") from exc

    if payload.get("schema") != "sauceapproved.hercules.video-render-request":
        raise gr.Error("Unsupported Hercules render request schema.")
    if int(payload.get("version", 0)) != 1:
        raise gr.Error("Unsupported Hercules render request version.")

    shot = payload.get("shot") or {}
    prompt = str(shot.get("prompt") or "").strip()
    if not prompt:
        raise gr.Error("Shot prompt is required.")

    ratio = str(shot.get("aspectRatio") or "")
    if ratio not in SUPPORTED_RATIOS:
        raise gr.Error("Wan2.2 ZeroGPU benchmark supports 16:9 or 9:16 only.")

    duration = float(shot.get("durationSeconds") or 0)
    if duration <= 0:
        raise gr.Error("Shot duration must be positive.")

    output = payload.get("output") or {}
    if str(output.get("resolution") or "720p") != "720p":
        raise gr.Error("Wan2.2 TI2V-5B ZeroGPU benchmark is restricted to 720p.")
    if int(output.get("fps") or 24) != 24:
        raise gr.Error("Wan2.2 TI2V-5B benchmark output is fixed at 24 FPS.")

    fingerprint = str(payload.get("requestFingerprint") or "")
    if len(fingerprint) != 64 or any(c not in "0123456789abcdefABCDEF" for c in fingerprint):
        raise gr.Error("Valid Hercules request fingerprint required.")

    return payload


def _frame_count(duration_seconds: float) -> int:
    desired = min(121, max(9, int(round(duration_seconds * 24)) + 1))
    return max(9, ((desired - 1) // 4) * 4 + 1)


@spaces.GPU(size="large", duration=300)
def generate(payload_json: str):
    request = _validated_request(payload_json)
    shot = request["shot"]
    height, width = SUPPORTED_RATIOS[shot["aspectRatio"]]
    frames = _frame_count(float(shot["durationSeconds"]))
    seed = request.get("seed")
    if seed is None:
        seed = int(request["requestFingerprint"][:8], 16)
    seed = int(seed)

    generator = torch.Generator(device="cuda").manual_seed(seed)
    result = pipe(
        prompt=shot["prompt"],
        height=height,
        width=width,
        num_frames=frames,
        num_inference_steps=30,
        guidance_scale=5.0,
        generator=generator,
    )

    output_path = os.path.join(tempfile.gettempdir(), f"hercules-{request['requestFingerprint'][:16]}.mp4")
    export_to_video(result.frames[0], output_path, fps=24)

    with open(output_path, "rb") as handle:
        digest = hashlib.sha256(handle.read()).hexdigest()

    size_bytes = os.path.getsize(output_path)
    duration_seconds = frames / 24.0
    metadata = {
        "schema": "sauceapproved.hercules.video-render-artifact-evidence",
        "version": 1,
        "requestFingerprint": request["requestFingerprint"],
        "modelRef": MODEL_REF,
        "seed": seed,
        "sha256": digest,
        "sizeBytes": size_bytes,
        "width": width,
        "height": height,
        "fps": 24,
        "frames": frames,
        "durationSeconds": duration_seconds,
        "backend": "huggingface-zerogpu",
        "fabricated": False,
    }
    return output_path, metadata


with gr.Blocks(title="SauceApproved Hercules Video · Wan2.2 ZeroGPU") as demo:
    gr.Markdown(
        "# SauceApproved Hercules Video\n"
        "Provider-neutral benchmark renderer. Hercules owns orchestration, quality gates, and evidence."
    )
    payload = gr.Textbox(label="Hercules render request", lines=12)
    run = gr.Button("Render")
    video = gr.Video(label="Rendered artifact")
    evidence = gr.JSON(label="Render evidence")
    run.click(generate, inputs=payload, outputs=[video, evidence], api_name="generate")

demo.launch()
