/* eslint-disable no-unused-vars */
import * as test from "./test.js";

import * as scanner from "./wgsl/test_scanner.js";
import * as parser from "./wgsl/test_parser.js";

function displayResults() {
    document.body.appendChild(document.createElement("p"));
    document.body.append(document.createElement("hr"));
    document.body.appendChild(document.createElement("p"));
    document.body.append(document.createTextNode("TOTAL TESTS: " + test.__test.totalTests));
    document.body.appendChild(document.createElement("br"));
    document.body.append(document.createTextNode("FAILED TESTS: " + test.__test.totalFailed));
}

if (test.__test.totalPromises.length) {
    Promise.all(test.__test.totalPromises).then(function() {
        displayResults();
    });
} else {
    displayResults();
}
