import test from 'node:test';import assert from 'node:assert/strict';
import {evaluatePdSelection} from '../hardware/soundworld/usb-c-pd-selection-v1.mjs';
const x={controller:'TPS25751',charger:'BQ25792',integratedChargerControl:true,pdCertified:true,drpCapable:true,protectedPowerPath:true,evtConfigValidated:false};
test('selects controller but blocks schematic freeze before EVT configuration validation',()=>assert.equal(evaluatePdSelection(x).fullSchematicFrozen,false));
test('freezes PD boundary after configuration evidence',()=>assert.equal(evaluatePdSelection({...x,evtConfigValidated:true}).fullSchematicFrozen,true));
test('rejects obsolete candidate',()=>assert.equal(evaluatePdSelection({...x,controller:'TPS25750',evtConfigValidated:true}).fullSchematicFrozen,false));