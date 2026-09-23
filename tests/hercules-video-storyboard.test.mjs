import assert from "node:assert/strict";
import test from "node:test";
import {compileStoryboard, continuityGroups, buildTournamentPlan, resolveTournament} from "../hercules-video/storyboard.mjs";

const brief = {
  title: "Test Campaign",
  aspectRatio: "9:16",
  audioStrategy: "post",
  brand: {visualLanguage:"dark premium", avoid:["robots"]},
  scenes: [
    {id:"a",durationSeconds:3,visual:"Control room",action:"System verifies",text:"VERIFY",audio:"pulse",continuityGroup:"hero"},
    {id:"b",durationSeconds:4,visual:"Recovery screen",action:"Rollback completes",continuityGroup:"hero"}
  ]
};

test("compiles a deterministic Hercules storyboard", () => {
  const a = compileStoryboard(brief);
  const b = compileStoryboard(brief);
  assert.equal(a.fingerprint, b.fingerprint);
  assert.equal(a.totalDurationSeconds, 7);
  assert.equal(a.shots[0].aspectRatio, "9:16");
  assert.equal(a.shots[0].requiresAudio, true);
  assert.equal(a.shots[0].audioStrategy, "post");
  assert.match(a.shots[0].prompt, /dark premium/);
});

test("tracks scene continuity groups", () => {
  const storyboard = compileStoryboard(brief);
  assert.deepEqual(continuityGroups(storyboard), {hero:["a","b"]});
});

test("builds two-engine tournament entries from routed candidates", () => {
  const storyboard = compileStoryboard(brief);
  const routes = storyboard.shots.map(shot => ({
    status:"routed",
    shotId:shot.id,
    selected:{providerId:"engine-a",routingScore:.9},
    alternates:[{providerId:"engine-b",routingScore:.8},{providerId:"engine-c",routingScore:.7}]
  }));
  const plan = buildTournamentPlan({storyboard,routes,candidatesPerShot:2});
  assert.equal(plan[0].entrants.length, 2);
  assert.equal(plan[0].entrants[1].providerId, "engine-b");
});

test("requires retry when every render is below quality threshold", () => {
  const [result] = resolveTournament([{
    shotId:"a",
    renders:[
      {id:"r1",providerId:"engine-a",quality:{promptAdherence:.5,temporalConsistency:.5,visualQuality:.5,brandConsistency:.5,audioQuality:.5,artifactFreedom:.5,reliability:.5}}
    ]
  }], .78);
  assert.equal(result.status, "retry_required");
});

test("selects a strong render when it clears threshold", () => {
  const [result] = resolveTournament([{
    shotId:"a",
    renders:[
      {id:"r1",providerId:"engine-a",quality:{promptAdherence:.8,temporalConsistency:.8,visualQuality:.8,brandConsistency:.8,audioQuality:.8,artifactFreedom:.8,reliability:.8}},
      {id:"r2",providerId:"engine-b",quality:{promptAdherence:.95,temporalConsistency:.94,visualQuality:.93,brandConsistency:.96,audioQuality:.9,artifactFreedom:.94,reliability:.9}}
    ]
  }], .78);
  assert.equal(result.status, "winner_selected");
  assert.equal(result.winner.id, "r2");
});
