import {createHash} from "node:crypto";
import {cp, mkdir, readFile, writeFile} from "node:fs/promises";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {runSmokeScreenGlobalBenchmark} from "./smokescreen-global-benchmark.mjs";

const ROOT=fileURLToPath(new URL("../",import.meta.url));
const VERSION="2.2.0";
const RELEASE_FILES=Object.freeze([
  "hercules-runtime/smokescreen-agent.mjs",
  "hercules-runtime/smokescreen-forge-ingress.mjs",
  "hercules-runtime/smokescreen-attack-enrichment.mjs",
  "scripts/smokescreen-global-benchmark.mjs",
  "tests/hercules-smokescreen-agent.test.mjs",
  "tests/hercules-smokescreen-forge-ingress.test.mjs",
  "tests/hercules-smokescreen-global-benchmark.test.mjs",
  "tests/hercules-smokescreen-attack-enrichment.test.mjs",
  "tests/hercules-smokescreen-release-package.test.mjs",
  "benchmarks/HERCULES-SMOKESCREEN-GLOBAL-BENCHMARK-2026-09-28.md",
  "releases/hercules-smokescreen-v2.2.0/README.md",
  "releases/hercules-smokescreen-v2.2.0/INSTALL.md",
  "releases/hercules-smokescreen-v2.2.0/SECURITY.md",
  "releases/hercules-smokescreen-v2.2.0/RELEASE-NOTES.md",
  "docs/HERCULES-SMOKESCREEN-SENTINEL-V1.md",
  "docs/HERCULES-THREAT-MODEL.md",
  "LICENSE",
  "SECURITY.md",
]);

function sha256(bytes){
  return createHash("sha256").update(bytes).digest("hex");
}

function resolvedCommitSha(value){
  const sha=String(value??"").trim();
  if(!/^[a-f0-9]{40}$/i.test(sha)){
    throw new Error("resolved 40-character commit SHA required");
  }
  return sha.toLowerCase();
}

export async function buildSmokeScreenReleaseManifest({commitSha}={}){
  const sourceCommit=resolvedCommitSha(commitSha);
  const files=[];
  for(const path of RELEASE_FILES){
    const bytes=await readFile(join(ROOT,path));
    files.push(Object.freeze({
      path,
      bytes:bytes.length,
      sha256:sha256(bytes),
    }));
  }

  const synthetic=runSmokeScreenGlobalBenchmark({
    hmacKey:"hercules-smokescreen-package-benchmark-key-2026",
    iterations:100,
  });

  if(!synthetic.passed){
    throw new Error("synthetic benchmark must pass before packaging");
  }

  const aggregateSha256=sha256(Buffer.from(
    files.map((file)=>file.path+":"+file.sha256).join("\n"),
    "utf8",
  ));

  return Object.freeze({
    schema:"sauceapproved.hercules.smokescreen.release.v1",
    product:"Hercules SmokeScreen Sentinel",
    version:VERSION,
    releaseClass:"public-community-preview",
    license:"Apache-2.0",
    canonicalRepository:"Sauceapproved7/expert-doodle",
    sourceCommit,
    defensiveOnly:true,
    scope:"OWNED_INFRASTRUCTURE_ONLY",
    outboundCounterattack:false,
    commercialCheckout:false,
    globalReadinessCoverageScore:64,
    globalReadinessScoreType:"internal-evidence-coverage-rubric",
    syntheticFixture:Object.freeze({
      scope:synthetic.scope,
      scenarios:synthetic.metrics.scenarios,
      hostileDetectionRate:synthetic.metrics.hostileDetectionRate,
      hostileDeceptionRate:synthetic.metrics.hostileDeceptionRate,
      falsePositiveDeceptionRate:synthetic.metrics.falsePositiveDeceptionRate,
      deceptionPrecision:synthetic.metrics.deceptionPrecision,
      safetyViolations:synthetic.metrics.safetyViolations,
      productionDetectionRateClaim:false,
      competitorPerformanceClaim:false,
    }),
    files:Object.freeze(files),
    aggregateSha256,
    nonClaims:Object.freeze([
      "The 100% synthetic-fixture results are not a 100/100 global market score.",
      "The 64/100 global-readiness score is an internal evidence-coverage rubric, not an independent certification.",
      "No proprietary competitor was performance-tested by this package.",
      "No production detection-rate claim is made.",
      "No external penetration-test assurance is claimed.",
    ]),
  });
}

async function writePackage({commitSha,outputDir}){
  const manifest=await buildSmokeScreenReleaseManifest({commitSha});
  const destination=resolve(ROOT,outputDir);
  await mkdir(destination,{recursive:true});

  for(const item of manifest.files){
    const target=join(destination,item.path);
    await mkdir(dirname(target),{recursive:true});
    await cp(join(ROOT,item.path),target);
  }

  await writeFile(
    join(destination,"smokescreen-release-manifest.json"),
    JSON.stringify(manifest,null,2)+"\n",
  );

  return {destination,manifest};
}

function parseArgs(argv){
  const out={
    commitSha:process.env.GITHUB_SHA||"",
    outputDir:"/tmp/hercules-smokescreen-v2.2.0",
  };
  for(let i=0;i<argv.length;i++){
    if(argv[i]==="--commit-sha")out.commitSha=argv[++i];
    else if(argv[i]==="--output-dir")out.outputDir=argv[++i];
    else throw new Error("unknown_argument:"+argv[i]);
  }
  return out;
}

async function main(){
  const result=await writePackage(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify({
    ok:true,
    destination:result.destination,
    product:result.manifest.product,
    version:result.manifest.version,
    sourceCommit:result.manifest.sourceCommit,
    aggregateSha256:result.manifest.aggregateSha256,
    files:result.manifest.files.length,
    globalReadinessCoverageScore:result.manifest.globalReadinessCoverageScore,
    syntheticFixture:result.manifest.syntheticFixture,
  },null,2));
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  main().catch((error)=>{
    console.error(error instanceof Error?error.message:error);
    process.exitCode=1;
  });
}
