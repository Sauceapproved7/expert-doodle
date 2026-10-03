import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateRfqLine} from '../hardware/soundworld/evt-rfq-freeze-v1.mjs';
test('accepts exact approved MPN from authorized source',()=>assert.equal(evaluateRfqLine({exactMpn:true,authorizedSource:true,traceable:true,substitution:false}).eligible,true));
test('rejects silent substitution',()=>assert.equal(evaluateRfqLine({exactMpn:false,authorizedSource:true,traceable:true,substitution:true}).eligible,false));
test('quote eligibility never authorizes purchase',()=>assert.equal(evaluateRfqLine({exactMpn:true,authorizedSource:true,traceable:true,substitution:false}).purchaseAuthorized,false));