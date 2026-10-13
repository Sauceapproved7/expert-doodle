import {cp,mkdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const src=join(root,'hercules-deploy/owned-circle/free-site');
const out=join(root,'dist/hercules-owned-circle');
const files=['index.html','app.css','app.mjs'];
await rm(out,{force:true,recursive:true});
await mkdir(out,{recursive:true});
for(const file of files)await cp(join(src,file),join(out,file));
process.stdout.write(JSON.stringify({
 status:'package-ready',product:'hercules-owned-circle',
 mode:'free-static-with-private-interest-rpc',
 artifacts:files,enabled:{unverifiedInterest:true,emailConfirmation:false,customerHosting:false,payments:false}
})+'\n');
