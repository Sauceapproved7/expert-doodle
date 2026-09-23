import {validateDatasetManifest, validateTrainingJob} from "./schema.mjs";

export function assertTrainableDatasets(datasetManifests) {
  if (!Array.isArray(datasetManifests) || datasetManifests.length === 0) {
    throw new TypeError("at least one dataset manifest is required");
  }

  return datasetManifests.map((input) => {
    const checked = validateDatasetManifest(input);
    if (!checked.ok) {
      throw new Error("dataset is not trainable: " + checked.errors.join("; "));
    }
    return {
      id: checked.dataset.id,
      contentSha256: checked.dataset.contentSha256,
      manifestFingerprint: checked.fingerprint,
    };
  });
}

export function createTrainingJob({
  id,
  modelId,
  task,
  datasetManifests,
  seed,
  codeCommit,
  trainer,
  hyperparameters = {},
  createdAt,
}) {
  const datasets = assertTrainableDatasets(datasetManifests);
  const checked = validateTrainingJob({
    id,
    modelId,
    task,
    datasets,
    seed,
    codeCommit,
    trainer,
    hyperparameters,
    createdAt,
  });

  if (!checked.ok) {
    throw new Error("invalid training job: " + checked.errors.join("; "));
  }

  return {
    job: checked.job,
    fingerprint: checked.fingerprint,
  };
}
