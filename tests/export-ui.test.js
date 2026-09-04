const test = require("node:test");
const assert = require("node:assert/strict");

const { primaryActionLabel, progressModel } = require("../lib/export-ui.js");

test("progressModel is indeterminate until a reliable total exists", () => {
  assert.deepEqual(progressModel(168, null), {
    mode: "indeterminate",
    percentage: null,
    ariaValue: null,
  });
  assert.deepEqual(progressModel(55, 111), {
    mode: "determinate",
    percentage: 50,
    ariaValue: "50",
  });
});

test("primaryActionLabel reflects idle, running, and completed states", () => {
  assert.equal(primaryActionLabel("idle", 111), "Export 111 ratings");
  assert.equal(primaryActionLabel("idle", 1), "Export 1 rating");
  assert.equal(primaryActionLabel("idle", null), "Export all ratings");
  assert.equal(primaryActionLabel("running", 111), "Exporting…");
  assert.equal(primaryActionLabel("complete", 111), "Export again");
});
