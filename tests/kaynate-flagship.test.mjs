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

test("KayNate flagship exposes the complete current menu structure, not only featured dishes", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");

  for (const dish of ["Curry Chicken", "Oxtail", "Curry Goat", "Ackee & Saltfish", "Beef Patty", "Jerk Salmon", "Red Peas Soup", "Rice n Peas", "Sweet Potato Pudding", "Plantain Chips"]) {
    assert.match(html, new RegExp(dish.replace("&", "\\&"), "i"));
  }

  for (const category of ["Breakfast", "Kids Menu", "Lunch / Dinner", "Porridge", "Seafood", "Sides", "Soup", "Drinks", "Vegan food", "Half Pan", "Full Pan", "Baked Products", "Snacks"]) {
    assert.match(html, new RegExp(category.replace("/", "\\/"), "i"));
  }

  const menuRows = html.match(/class="menu-row/g) || [];
  assert.ok(menuRows.length >= 120, "expected the full catalog to be rendered");
});


test("KayNate full menu has fast customer navigation controls", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const js = await readFile(new URL("app.js", root), "utf8");

  assert.match(html, /id="menuSearch"/);
  assert.match(html, /id="availabilityFilter"/);
  assert.match(html, /id="menuCount"/);
  assert.match(js, /filterMenu/);
  assert.match(js, /data-menu-name/);
});
