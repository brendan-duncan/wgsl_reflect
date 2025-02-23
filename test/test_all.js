/* eslint-disable no-unused-vars */
import * as test from "./test.js";

import * as scanner from "./tests/test_scanner.js";
import * as parser from "./tests/test_parser.js";
import * as struct from "./tests/struct.js";
import * as reflect from "./tests/test_reflect.js";
import * as struct_layout from "./tests/struct_layout.js";
import * as exec from "./tests/test_exec.js";
import * as debug from "./tests/test_debug.js";

function displayResults() {
  document.body.appendChild(document.createElement("p"));
  document.body.append(document.createElement("hr"));
  document.body.appendChild(document.createElement("p"));
  document.body.append(
    document.createTextNode("TOTAL TESTS: " + test.__test.totalTests)
  );
  document.body.appendChild(document.createElement("br"));
  document.body.append(
    document.createTextNode("FAILED TESTS: " + test.__test.totalFailed)
  );
}

async function runTests() {
  /*await scanner.run();
  await parser.run();
  await struct.run();
  await reflect.run();
  await struct_layout.run();*/
  await exec.run();
  await debug.run();
  displayResults();
}

await runTests();
