/* eslint-disable no-unused-vars */
import * as test from "./test.js";

import * as scanner from "./tests/test_scanner.js";
import * as parser from "./tests/test_parser.js";
import * as struct from "./tests/struct.js";
import * as reflect from "./tests/test_reflect.js";
import * as struct_layout from "./tests/struct_layout.js";

function displayResults() {
    document.body.appendChild(document.createElement("p"));
    document.body.append(document.createElement("hr"));
    document.body.appendChild(document.createElement("p"));
    document.body.append(document.createTextNode("TOTAL TESTS: " + test.__test.totalTests));
    document.body.appendChild(document.createElement("br"));
    document.body.append(document.createTextNode("FAILED TESTS: " + test.__test.totalFailed));
}

displayResults();
