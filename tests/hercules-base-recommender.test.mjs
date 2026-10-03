import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeRecommendationRequest,
  recommendResources,
} from "../hercules-base/recommender.mjs";

test("recommendation engine ranks relevant resources deterministically with explanations", () => {
  const request=normalizeRecommendationRequest({
    query:"secure Shopify checkout service",
    signals:["shopify","typescript","api","security"],
    allowedScopes:["public","owner"],
    alreadyKnown:["existing-module"],
    limit:3,
  });

  const resources=[
    {
      id:"existing-module",
      title:"Existing Shopify helper",
      kind:"internal-module",
      scope:"owner",
      tags:["shopify","typescript"],
      capabilities:["api"],
      trust:"owned",
    },
    {
      id:"security-control",
      title:"Webhook HMAC verifier",
      kind:"security-control",
      scope:"owner",
      tags:["shopify","security","webhook"],
      capabilities:["api"],
      trust:"owned",
    },
    {
      id:"api-library",
      title:"GraphQL client adapter",
      kind:"library",
      scope:"public",
      tags:["shopify","typescript","graphql"],
      capabilities:["api"],
      trust:"reviewed",
    },
    {
      id:"unrelated",
      title:"Video render queue",
      kind:"internal-module",
      scope:"owner",
      tags:["video","ffmpeg"],
      capabilities:["rendering"],
      trust:"owned",
    },
  ];

  const first=recommendResources(request,resources);
  const second=recommendResources(request,[...resources].reverse());

  assert.deepEqual(first,second);
  assert.deepEqual(first.map((item)=>item.id),["security-control","api-library","unrelated"]);
  assert.equal(first.some((item)=>item.id==="existing-module"),false);
  assert.match(first[0].reason,/shopify/i);
  assert.match(first[0].reason,/security/i);
});

test("recommendation engine fails closed on resource scopes the caller is not allowed to see", () => {
  const request=normalizeRecommendationRequest({
    query:"deployment",
    signals:["deployment"],
    allowedScopes:["public"],
  });

  const result=recommendResources(request,[
    {
      id:"private-deployer",
      title:"Owner deployer",
      kind:"internal-module",
      scope:"owner",
      tags:["deployment"],
      capabilities:["deploy"],
      trust:"owned",
    },
    {
      id:"public-guide",
      title:"Public deployment guide",
      kind:"documentation",
      scope:"public",
      tags:["deployment"],
      capabilities:["deploy"],
      trust:"reviewed",
    },
  ]);

  assert.deepEqual(result.map((item)=>item.id),["public-guide"]);
});

test("recommendation engine rejects malformed input instead of guessing", () => {
  assert.throws(
    ()=>normalizeRecommendationRequest({
      query:"x",
      signals:["ok",42],
      allowedScopes:["public"],
    }),
    /signal/i,
  );

  assert.throws(
    ()=>normalizeRecommendationRequest({
      query:"x",
      signals:["ok"],
      allowedScopes:["public","unknown"],
    }),
    /scope/i,
  );
});

test("recommendation results do not echo arbitrary source metadata or credential-shaped fields", () => {
  const request=normalizeRecommendationRequest({
    query:"shopify api",
    signals:["shopify","api"],
    allowedScopes:["owner"],
  });

  const result=recommendResources(request,[{
    id:"safe-adapter",
    title:"Safe adapter",
    kind:"internal-module",
    scope:"owner",
    tags:["shopify","api"],
    capabilities:["api"],
    trust:"owned",
    accessToken:"do-not-echo",
    metadata:{secret:"do-not-echo"},
  }]);

  const serialized=JSON.stringify(result);
  assert.equal(serialized.includes("do-not-echo"),false);
  assert.deepEqual(
    Object.keys(result[0]).sort(),
    ["id","kind","reason","score","title"].sort(),
  );
});
