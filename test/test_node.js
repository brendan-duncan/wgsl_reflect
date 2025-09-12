import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import {JSDOM as Jsdom} from 'jsdom'
import { failedTests, runTests } from './test_all.js'
import { create, globals as gpuGlobals } from 'webgpu';

Object.assign(globalThis, gpuGlobals);
const dom = new Jsdom(await readFile('index.html'));
const document = dom.window.document;
// remove autorun script to harvest a static html result file
for (const e of document.querySelectorAll("script")) {
  e.remove()
}
globalThis.document = document;
globalThis.navigator.gpu = create([]);

try {
  await runTests()
  const fileContents = dom.serialize()
  await writeFile("result.html", fileContents)
} finally {
  // https://www.npmjs.com/package/webgpu#notes
  globalThis.document = null
  globalThis.navigator.gpu = null
}
if (failedTests()) {
  console.error("test errors:", failedTests())
  process.exitCode = 1;
}
