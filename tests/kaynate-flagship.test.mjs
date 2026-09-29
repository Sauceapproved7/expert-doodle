import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root = new URL("../clients/kaynate-flagship/", import.meta.url);

test("KayNate flagship removes the rejected family-name story and preserves core business identity", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const css = await readFile(new URL("styles.css", root), "utf8");
  const js = await readFile(new URL("app.js", root), "utf8");
  const all = [html, css, js].join("\n");

  assert.match(html, /KayNate Jamaican Kitchen/i);
  assert.match(html, /50 Rapallo Avenue/i);
  assert.match(html, /\(860\) 788-7661/);
  assert.equal(/McCray/i.test(all), false);
});

test("KayNate flagship includes Hercules-grade interactive restaurant software features", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const js = await readFile(new URL("app.js", root), "utf8");

  assert.match(html, /Flavor Finder/i);
  assert.match(html, /Catering Builder/i);
  assert.match(js, /recommendDish/);
  assert.match(js, /estimateCatering/);
  assert.match(js, /orderUrl/);
});

test("KayNate flagship exposes real menu anchors from the current ordering catalog", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");

  for (const dish of ["Curry Chicken", "Oxtail", "Curry Goat", "Ackee & Saltfish", "Beef Patty"]) {
    assert.match(html, new RegExp(dish.replace("&", "\\&"), "i"));
  }
});
