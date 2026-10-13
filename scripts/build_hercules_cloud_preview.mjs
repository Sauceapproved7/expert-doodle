import {cp,mkdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,join} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=join(root,'hercules-deploy/cloud');
const output=join(root,'dist/hercules-cloud');
const assets=['index.html','styles.css','app.mjs'];
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
for(const file of assets)await cp(join(source,file),join(output,file));
process.stdout.write(JSON.stringify({ok:true,site:'hercules-cloud-preview',mode:'static-shadow-only',assets})+'\n');
