#!/usr/bin/env node
import dns from 'node:dns/promises';

const BLOG_HOST = process.env.WORDPRESS_HOST || 'blog.sauceapproved.com';
const ROOT_HOST = process.env.ROOT_HOST || 'sauceapproved.com';
const WWW_HOST = process.env.WWW_HOST || 'www.sauceapproved.com';
const SOURCE_SITE = process.env.WORDPRESS_SOURCE_SITE || 'sauce718-ucbep.wordpress.com';

const out = {
  checkedAt: new Date().toISOString(),
  targets: { blog: BLOG_HOST, root: ROOT_HOST, www: WWW_HOST, sourceSite: SOURCE_SITE },
  checks: {},
  ok: true,
};

function fail(name, detail) {
  out.checks[name] = { ok: false, ...detail };
  out.ok = false;
}

function pass(name, detail) {
  out.checks[name] = { ok: true, ...detail };
}

async function resolveHost(host) {
  const result = { a: [], aaaa: [], cname: [] };
  try { result.a = await dns.resolve4(host); } catch {}
  try { result.aaaa = await dns.resolve6(host); } catch {}
  try { result.cname = await dns.resolveCname(host); } catch {}
  return result;
}

async function probe(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
      headers: { 'user-agent': 'Hercules-WordPress-Launch-Check/1.0' },
    });
    const text = (await res.text()).slice(0, 100000);
    return {
      reachable: true,
      status: res.status,
      finalUrl: res.url,
      wordpressSignals: /wp-content|wp-includes|wordpress/i.test(text),
      sauceApprovedSignals: /SauceApproved|Hercules/i.test(text),
    };
  } catch (error) {
    return { reachable: false, error: error instanceof Error ? error.message : String(error) };
  }
}

const blogDns = await resolveHost(BLOG_HOST);
if (!blogDns.a.length && !blogDns.aaaa.length && !blogDns.cname.length) {
  fail('blog_dns', { host: BLOG_HOST, resolution: blogDns, reason: 'blog_host_does_not_resolve' });
} else {
  pass('blog_dns', { host: BLOG_HOST, resolution: blogDns });
}

const blogHttps = await probe(`https://${BLOG_HOST}/`);
if (!blogHttps.reachable || blogHttps.status >= 500) {
  fail('blog_https', blogHttps);
} else if (!blogHttps.wordpressSignals) {
  fail('blog_wordpress_front_door', { ...blogHttps, reason: 'wordpress_signals_not_detected' });
} else {
  pass('blog_https', blogHttps);
  pass('blog_wordpress_front_door', blogHttps);
}

const rootHttps = await probe(`https://${ROOT_HOST}/`);
if (!rootHttps.reachable || rootHttps.status >= 500) {
  fail('root_storefront', rootHttps);
} else if (rootHttps.finalUrl.includes(BLOG_HOST)) {
  fail('root_storefront', { ...rootHttps, reason: 'root_redirected_to_wordpress_blog' });
} else {
  pass('root_storefront', rootHttps);
}

const wwwHttps = await probe(`https://${WWW_HOST}/`);
if (!wwwHttps.reachable || wwwHttps.status >= 500) {
  fail('www_storefront', wwwHttps);
} else if (wwwHttps.finalUrl.includes(BLOG_HOST)) {
  fail('www_storefront', { ...wwwHttps, reason: 'www_redirected_to_wordpress_blog' });
} else {
  pass('www_storefront', wwwHttps);
}

const sourceHttps = await probe(`https://${SOURCE_SITE}/`);
if (!sourceHttps.reachable || sourceHttps.status >= 500) {
  fail('wordpress_source_site', sourceHttps);
} else {
  pass('wordpress_source_site', sourceHttps);
}

console.log(JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 1);
