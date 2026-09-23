import {fingerprint, validateShot, selectBestRender} from "./core.mjs";

export function compileStoryboard(brief) {
  if (!brief || typeof brief !== "object") throw new Error("brief_required");
  if (!String(brief.title || "").trim()) throw new Error("brief_title_required");
  if (!Array.isArray(brief.scenes) || brief.scenes.length === 0) throw new Error("brief_scenes_required");

  const shots = brief.scenes.map((scene, index) => {
    const id = String(scene.id || `shot-${String(index + 1).padStart(2, "0")}`);
    const promptParts = [
      scene.visual,
      scene.action,
      scene.camera ? `Camera: ${scene.camera}` : "",
      scene.style ? `Style: ${scene.style}` : "",
      scene.text ? `On-screen text: ${scene.text}` : "",
      scene.audio ? `Audio: ${scene.audio}` : "",
      brief.brand?.visualLanguage ? `Brand language: ${brief.brand.visualLanguage}` : "",
      brief.brand?.avoid?.length ? `Avoid: ${brief.brand.avoid.join(", ")}` : "",
    ].filter(Boolean);

    return validateShot({
      id,
      prompt: promptParts.join(". "),
      durationSeconds: Number(scene.durationSeconds || brief.defaultDurationSeconds || 4),
      aspectRatio: scene.aspectRatio || brief.aspectRatio || "9:16",
      requiresAudio: Boolean(scene.audio || brief.requireAudio),
      audioStrategy: scene.audioStrategy || brief.audioStrategy || (scene.audio || brief.requireAudio ? "native" : "none"),
      requiresReferences: Boolean(scene.requiresReferences),
      requiresEditing: Boolean(scene.requiresEditing),
      continuityGroup: scene.continuityGroup || null,
      purpose: scene.purpose || null,
      text: scene.text || null,
    });
  });

  const compiled = {
    schema: "sauceapproved.hercules.video-storyboard",
    version: 1,
    title: brief.title,
    campaign: brief.campaign || null,
    aspectRatio: brief.aspectRatio || "9:16",
    brand: brief.brand || {},
    shots,
    totalDurationSeconds: shots.reduce((sum, shot) => sum + shot.durationSeconds, 0),
  };

  return {...compiled, fingerprint: fingerprint(compiled)};
}

export function continuityGroups(storyboard) {
  const groups = new Map();
  for (const shot of storyboard.shots || []) {
    if (!shot.continuityGroup) continue;
    const current = groups.get(shot.continuityGroup) || [];
    current.push(shot.id);
    groups.set(shot.continuityGroup, current);
  }
  return Object.fromEntries(groups);
}

export function buildTournamentPlan({storyboard, routes, candidatesPerShot = 2}) {
  if (!storyboard?.shots?.length) throw new Error("storyboard_required");
  const routeByShot = new Map((routes || []).map(route => [route.shotId, route]));
  return storyboard.shots.map(shot => {
    const route = routeByShot.get(shot.id);
    if (!route || route.status !== "routed") {
      return {shotId: shot.id, status: "blocked", reason: route?.reason || "missing_route", entrants: []};
    }
    const entrants = [route.selected, ...(route.alternates || [])].slice(0, Math.max(1, candidatesPerShot));
    return {shotId: shot.id, status: "ready", entrants};
  });
}

export function resolveTournament(rounds, minimumScore = 0.78) {
  if (!Array.isArray(rounds) || rounds.length === 0) throw new Error("tournament_rounds_required");
  return rounds.map(round => {
    if (!Array.isArray(round.renders) || round.renders.length === 0) {
      return {shotId: round.shotId, status: "retry_required", reason: "no_renders"};
    }
    const winner = selectBestRender(round.renders);
    if (winner.evaluation.score < minimumScore) {
      return {
        shotId: round.shotId,
        status: "retry_required",
        reason: "quality_below_threshold",
        bestScore: winner.evaluation.score,
        bestRenderId: winner.id,
      };
    }
    return {
      shotId: round.shotId,
      status: "winner_selected",
      winner,
    };
  });
}
