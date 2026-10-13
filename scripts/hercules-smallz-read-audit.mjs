/**
 * One-shot, opt-in, read-only Smallz release evidence command.
 * Never accepts credentials on argv or stdin, never prints raw errors, never
 * deploys, changes provider settings, or exposes a network listener.
 *
 * This executable is intentionally NOT wired into the Deploy Plane worker.
 * A separately authorized server environment must provide dedicated read
 * credentials and HERCULES_SMALLZ_READ_AUDIT_ENABLED=true.
 */
import {runSmallzReleaseReadAudit} from '../hercules-deploy/smallz-read-audit.mjs';

let result;
try{
  result=await runSmallzReleaseReadAudit({env:process.env});
}catch{
  result={
    schema:'sauceapproved.hercules.smallz-read-audit.v1',
    status:'HOLD',reasonCodes:['AUDIT_INTERNAL_FAILURE'],
    providerRecordsIndependentlyAuthenticated:false,
    ownerAuthorizationVerified:false,releaseApproved:false,
    productionChanged:false,executionAuthority:false
  };
}
process.stdout.write(JSON.stringify(result)+'\n');
if(result.status==='HOLD')process.exitCode=2;
