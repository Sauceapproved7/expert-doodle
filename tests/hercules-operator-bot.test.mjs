import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyCommand, authorizeCommand, createReceipt } from '../hercules-bot/operator-core.mjs';

test('read-only commands can run in direct mode', () => {
  const cmd = classifyCommand({verb:'inspect', target:'repo', mutates:false});
  assert.equal(cmd.risk, 'read');
  assert.equal(authorizeCommand(cmd,{mode:'direct',ownerApproved:false}).decision,'allow');
});

test('mutations require explicit owner approval', () => {
  const cmd = classifyCommand({verb:'deploy', target:'production', mutates:true});
  assert.equal(authorizeCommand(cmd,{mode:'direct',ownerApproved:false}).decision,'hold');
  assert.equal(authorizeCommand(cmd,{mode:'direct',ownerApproved:true}).decision,'allow');
});

test('forbidden capabilities are denied even when requested', () => {
  const cmd = classifyCommand({verb:'disable-safety', target:'guardian', mutates:true});
  assert.equal(authorizeCommand(cmd,{mode:'direct',ownerApproved:true}).decision,'deny');
});

test('kill switch denies all execution', () => {
  const cmd = classifyCommand({verb:'inspect', target:'repo', mutates:false});
  assert.equal(authorizeCommand(cmd,{mode:'direct',ownerApproved:true,killSwitch:true}).decision,'deny');
});

test('receipts preserve command, decision and timestamp', () => {
  const cmd = classifyCommand({verb:'inspect',target:'vault',mutates:false});
  const auth = authorizeCommand(cmd,{mode:'direct'});
  const receipt=createReceipt(cmd,auth,{now:'2026-10-03T03:00:00.000Z'});
  assert.equal(receipt.command.verb,'inspect');
  assert.equal(receipt.authorization.decision,'allow');
  assert.equal(receipt.timestamp,'2026-10-03T03:00:00.000Z');
});
