#!/usr/bin/env python3
import json
import os
import sys

MODEL_ID = "Qwen/Qwen3-VL-4B-Instruct"

def fail(message):
    sys.stderr.write(message + "\n")
    sys.exit(2)

def extract_json_object(text):
    decoder = json.JSONDecoder()
    for index, char in enumerate(text):
        if char != "{":
            continue
        try:
            value, _ = decoder.raw_decode(text[index:])
            if isinstance(value, dict):
                return value
        except json.JSONDecodeError:
            continue
    raise ValueError("no_json_object")

def main():
    try:
        request = json.loads(sys.stdin.read())
    except Exception:
        fail("invalid_request_json")

    if request.get("schema") != "sauceapproved.hercules.video-qwen-evaluation-request":
        fail("invalid_request_schema")
    if request.get("modelId") != MODEL_ID:
        fail("invalid_model_id")

    model_dir = request.get("modelDir")
    video_uri = request.get("videoUri")
    if not isinstance(model_dir, str) or not os.path.isabs(model_dir):
        fail("model_dir_required")
    if not isinstance(video_uri, str) or not video_uri.startswith("file://"):
        fail("local_video_required")

    try:
        from transformers import Qwen3VLForConditionalGeneration, AutoProcessor
        from qwen_vl_utils import process_vision_info
    except Exception as exc:
        fail("qwen_dependencies_unavailable:" + str(exc))

    shot = request.get("shot") or {}
    technical = request.get("technical")
    sample_fps = float(request.get("sampleFps") or 2.0)

    rubric = {
        "promptAdherence": "How accurately the video follows the requested scene, action, text, and visual intent.",
        "temporalConsistency": "How stable subjects, geometry, lighting, motion, and identity remain across time.",
        "visualQuality": "Overall cinematic clarity, composition, detail, motion quality, and professional finish.",
        "brandConsistency": "How well the video matches the requested Hercules premium dark operator-control visual language.",
        "artifactFreedom": "Absence of warping, flicker, broken text, duplicate objects, malformed UI, and generation artifacts.",
        "reliability": "Confidence that the scores are supported by visible evidence in the video."
    }
    instruction = (
        "Evaluate this generated video for Hercules. Return JSON only, with no markdown. "
        "Each score must be a number from 0 to 1. Use this exact shape: "
        '{"scores":{"promptAdherence":0.0,"temporalConsistency":0.0,"visualQuality":0.0,'
        '"brandConsistency":0.0,"artifactFreedom":0.0,"reliability":0.0},'
        '"notes":["short evidence note"]}. '
        "Be strict. Do not reward the video for audio because audio may be added later. "
        "Judge only visible evidence. Requested shot: " + json.dumps(shot, ensure_ascii=False) +
        ". Technical evidence: " + json.dumps(technical, ensure_ascii=False) +
        ". Rubric: " + json.dumps(rubric, ensure_ascii=False)
    )

    messages = [{
        "role": "user",
        "content": [
            {"type": "video", "video": video_uri, "fps": sample_fps},
            {"type": "text", "text": instruction},
        ],
    }]

    try:
        processor = AutoProcessor.from_pretrained(model_dir, local_files_only=True)
        model = Qwen3VLForConditionalGeneration.from_pretrained(
            model_dir,
            dtype="auto",
            device_map="auto",
            local_files_only=True,
        )
        text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        images, videos, video_kwargs = process_vision_info(
            messages,
            image_patch_size=16,
            return_video_kwargs=True,
            return_video_metadata=True,
        )
        if videos is not None:
            videos, video_metadatas = zip(*videos)
            videos, video_metadatas = list(videos), list(video_metadatas)
        else:
            video_metadatas = None
        inputs = processor(
            text=text,
            images=images,
            videos=videos,
            video_metadata=video_metadatas,
            return_tensors="pt",
            do_resize=False,
            **video_kwargs,
        )
        inputs = inputs.to(model.device)
        generated_ids = model.generate(**inputs, max_new_tokens=320, do_sample=False)
        trimmed = [
            output_ids[len(input_ids):]
            for input_ids, output_ids in zip(inputs.input_ids, generated_ids)
        ]
        decoded = processor.batch_decode(
            trimmed,
            skip_special_tokens=True,
            clean_up_tokenization_spaces=False,
        )[0]
        result = extract_json_object(decoded)
        scores = result.get("scores")
        if not isinstance(scores, dict):
            raise ValueError("scores_missing")
        output = {
            "ok": True,
            "modelId": MODEL_ID,
            "modelRevision": request.get("modelRevision"),
            "sampledFps": sample_fps,
            "scores": scores,
            "notes": result.get("notes") if isinstance(result.get("notes"), list) else [],
        }
        sys.stdout.write(json.dumps(output, separators=(",", ":")))
    except Exception as exc:
        fail("qwen_evaluation_failed:" + str(exc))

if __name__ == "__main__":
    main()
