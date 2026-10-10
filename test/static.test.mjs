import assert from "node:assert/strict";
import test from "node:test";
import { staticAsset } from "../src/static.mjs";

test("serves the console shell with a correct content type", async () => {
  const asset = await staticAsset("/");
  assert.match(asset.contentType, /text\/html/);
  assert.match(asset.body.toString(), /Kite x402 Target Guard/);
});

test("does not expose files outside the public directory", async () => {
  assert.equal(await staticAsset("/../../package.json"), null);
});

test("ships a browser client for live evaluations", async () => {
  const asset = await staticAsset("/app.js");
  assert.match(asset.contentType, /javascript/);
  assert.match(asset.body.toString(), /\/v1\/evaluate/);
});
