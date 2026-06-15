import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";

const helperSource = readFileSync(new URL("../src/lib/application-status.ts", import.meta.url), "utf8");
const transpiled = ts.transpileModule(helperSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const tempDir = mkdtempSync(join(tmpdir(), "applywise-status-"));
const helperPath = join(tempDir, "application-status.mjs");
writeFileSync(helperPath, transpiled.outputText);

const {
  applicationStatusSuccessMessage,
  buildApplicationStatusPayload,
  replaceApplicationRecord,
  resolveStatusUpdateDecision,
} = await import(pathToFileURL(helperPath));

test("clicking Cancel keeps status unchanged", () => {
  let confirmCalls = 0;
  const decision = resolveStatusUpdateDecision("applied", false, () => {
    confirmCalls += 1;
    return false;
  });

  assert.equal(confirmCalls, 1);
  assert.deepEqual(decision, { proceed: false, manualSubmissionConfirmed: false });
});

test("clicking OK changes status to Applied with manual confirmation payload", () => {
  let confirmCalls = 0;
  const decision = resolveStatusUpdateDecision("applied", false, () => {
    confirmCalls += 1;
    return true;
  });
  const payload = buildApplicationStatusPayload("applied", decision.manualSubmissionConfirmed);
  const applications = [{ id: "app-1", status: "saved" }];
  const updated = { id: "app-1", status: "applied" };

  assert.equal(confirmCalls, 1);
  assert.deepEqual(decision, { proceed: true, manualSubmissionConfirmed: true });
  assert.deepEqual(payload, { status: "applied", manual_submission_confirmed: true });
  assert.deepEqual(replaceApplicationRecord(applications, updated), [updated]);
  assert.equal(applicationStatusSuccessMessage("applied"), "Application marked Applied after manual submission.");
});

test("pre-confirmed Mark Applied button path does not show a second confirmation", () => {
  let confirmCalls = 0;
  const decision = resolveStatusUpdateDecision("applied", true, () => {
    confirmCalls += 1;
    return false;
  });

  assert.equal(confirmCalls, 0);
  assert.deepEqual(decision, { proceed: true, manualSubmissionConfirmed: true });
  assert.deepEqual(buildApplicationStatusPayload("applied", decision.manualSubmissionConfirmed), {
    status: "applied",
    manual_submission_confirmed: true,
  });
});
