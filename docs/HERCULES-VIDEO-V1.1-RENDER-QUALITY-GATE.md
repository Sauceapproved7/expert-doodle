# Hercules Video v1.1 — Render Acceptance Gate

## Purpose

A render completing successfully does not mean Hercules should use it.

v1.1 adds a Hercules-owned acceptance gate before tournament scoring.

## Layer 1: technical media gate

The local technical gate verifies:

- a real local video file exists,
- a video stream is present,
- dimensions are valid,
- aspect ratio is within policy tolerance,
- duration is within policy tolerance,
- frame rate is within policy tolerance.

The default probe uses local `ffprobe` through an injectable boundary.

## Layer 2: semantic quality evaluator

Prompt adherence, temporal consistency, visual quality, brand consistency, artifact freedom, and reliability are supplied through an injected semantic evaluator.

Hercules normalizes those scores into the existing quality dimensions.

For shots using `audioStrategy: post`, native audio is not part of the visual render's responsibility, so the render is not penalized for missing native audio.

## Fail-closed behavior

Technical failure happens before semantic scoring and blocks the render from tournament use.

The semantic evaluator is required; Hercules does not invent visual-quality scores.

## Ownership boundary

Hercules owns:

- technical acceptance policy,
- score normalization,
- post-audio treatment,
- the evaluator contract.

A future local vision/video model may implement semantic evaluation behind this boundary without changing the campaign execution service.
