#!/usr/bin/env node
import {probePublicWitness} from '../hercules-runtime/runtime-witness.mjs';

function usage(){return 'Usage: node scripts/hercules-runtime-witness.mjs --probe --target smallz-launch|studio-activation [--samples 1..5] [--json]\n';}
const input=process.argv.slice(2);
let probe=false,target=null,samples=3,json=false;
const seen=new Set();
for(let i=0;i<input.length;i++){
  const flag=input[i];
  if(seen.has(flag)&&flag.startsWith('--')) {process.stderr.write('duplicate_option\n'+usage());process.exit(2)}
  seen.add(flag);
  if(flag==='--probe')probe=true;
  else if(flag==='--json')json=true;
  else if(flag==='--target')target=input[++i]??null;
  else if(flag==='--samples')samples=Number(input[++i]);
  else {process.stderr.write('unsupported_option\n'+usage());process.exit(2)}
}
if(!probe||!target){process.stderr.write('explicit_probe_and_target_required\n'+usage());process.exit(2)}
try{
  const report=await probePublicWitness({target,samples});
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  if(!report.allSamplesPassed)process.exitCode=1;
}catch(error){
  process.stderr.write(error.message+'\n'+usage());
  process.exitCode=2;
}
