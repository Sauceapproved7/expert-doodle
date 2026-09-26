# Hercules Vision Pixel v0.2

## Purpose

Hercules Vision Pixel v0.2 is the first Hercules-native model that learns from **actual raster pixels** rather than routing text about images.

It does not replace active Vision v0.1, which remains the production visual-request control model.

## Pixel task

The candidate learns five 12×12 grayscale/binary visual primitives:

- horizontal bar
- vertical bar
- cross
- box
- diagonal

Training and evaluation images include position shifts, line-thickness changes, and deterministic pixel noise.

The held-out set uses variants that are not present in the training set.

## Architecture

The candidate is implemented entirely in repository-owned JavaScript:

- 144 pixel inputs
- one learned ReLU hidden layer
- 12 hidden units
- learned softmax output across five visual classes
- deterministic seeded SGD
- 48 training epochs

No third-party image dataset, pretrained vision model, image ML framework, or vision SDK is packaged.

## Candidate gates

The held-out noisy raster set must satisfy:

- accuracy >= 0.90
- minimum per-class recall >= 0.80
- improvement over a uniform five-class baseline >= 0.65

Passing these thresholds creates a candidate checkpoint only.

## Reproducible build

    HERCULES_SOURCE_COMMIT=$(git rev-parse HEAD) \
      node hercules-training/bootstrap-vision-pixel-v0.2.mjs

Outputs:

- `.hercules-training/vision-pixel-v0.2/checkpoint.json`
- `.hercules-training/vision-pixel-v0.2/training-evidence.json`

## Capability limit

Vision Pixel v0.2 is a real pixel-native learned model, but it is a deliberately small visual foundation. It does not yet perform general photograph understanding, OCR, object detection, or screenshot reasoning.

The next Vision stages can add larger raster sizes, convolutional filters, richer owner-authored visual corpora, and eventually general screenshot/document perception while preserving the same provenance and promotion controls.
