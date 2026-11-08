// Run with: node --conditions=react-server --test components/lecturer/course-quick-actions.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import * as jsx from "react/jsx-runtime";
import ts from "typescript";
import { renderToReadableStream, registerClientReference } from "next/dist/compiled/react-server-dom-webpack/server.node.js";

test("course shortcuts cross the server component boundary without crashing", async () => {
  const source = readFileSync(new URL("./course-quick-actions.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const Link = registerClientReference(() => {}, "next/link", "default");
  const Icon = () => React.createElement("svg");
  const mocks = {
    "react/jsx-runtime": jsx,
    "next/link": { default: Link },
    "lucide-react": { ClipboardList: Icon, FileText: Icon, Swords: Icon, Users: Icon },
  };
  const exports = {};
  new Function("require", "exports", compiled)(id => {
    assert.ok(id in mocks, `Unexpected import: ${id}`);
    return mocks[id];
  }, exports);
  const errors = [];
  const stream = renderToReadableStream(
    React.createElement(exports.CourseQuickActions, { offeringId: "assigned-course" }),
    { "next/link": { id: "next/link", chunks: [], name: "default" } },
    { onError: error => { errors.push(error.message); } },
  );
  const payload = await new Response(stream).text();
  assert.deepEqual(errors, []);
  for (const destination of ["quizzes", "challenges", "students", "content"]) {
    assert.ok(payload.includes(`/lecturer/courses/assigned-course/${destination}`));
  }
  assert.ok(payload.includes("Course shortcuts"));
});
