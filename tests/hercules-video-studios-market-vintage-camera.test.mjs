import assert from 'node:assert/strict';
import test from 'node:test';
import {createStudiosMarketManifest} from '../sauceapproved-studio/market/core.mjs';
import {createStudioHttpHandler} from '../hercules-video/studio-server.mjs';

test('Studios Market exposes Vintage Camera as a free preview without opening paid checkout',async()=>{
  const manifest=createStudiosMarketManifest();
  const item=manifest.products.find(product=>product.id==='vintage-camera');
  assert.ok(item);
  assert.equal(item.route,'/vintage-camera');
  assert.equal(item.availability,'free-preview');
  assert.equal(item.ctaLabel,'Try free preview');
  assert.equal(item.ctaUrl,'/vintage-camera');
  assert.equal(manifest.paidCheckoutEnabled,false);

  const handle=createStudioHttpHandler();
  const response=await handle({method:'GET',pathname:'/market'});
  assert.equal(response.status,200);
  assert.match(response.body,/Vintage Camera/);
  assert.match(response.body,/href="\/vintage-camera"/);
  assert.match(response.body,/Try free preview/);
  assert.match(response.body,/Paid checkout remains locked/);
});
