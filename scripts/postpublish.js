const fs = require('fs');
const path = require('path');
const pkgpath = path.resolve('package.json');

let pkg = fs.readFileSync(pkgpath, 'utf8');
pkg = pkg
    .replace(`"main": "dist/index.umd.js"`, `"main": "src/index.ts"`)
    .replace(`"types": "lib/index.d.ts"`, `"types": "src/index.ts"`)
    .replace(`"module": "dist/index.mjs"`, `"module": "src/index.ts"`)
    ;

fs.writeFileSync(pkgpath, pkg, 'utf8');
