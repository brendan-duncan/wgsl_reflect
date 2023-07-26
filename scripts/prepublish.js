const fs = require('fs');
const path = require('path');
const pkgpath = path.resolve('package.json');

let pkg = fs.readFileSync(pkgpath, 'utf8');
pkg = pkg.replace(`"main": "src/index.ts"`, `"main": "dist/index.umd.js"`)
    .replace(`"types": "src/index.ts"`, `"types": "lib/index.d.ts"`)
    .replace(`"module": "src/index.ts"`, `"module": "dist/index.mjs"`)
    ;

fs.writeFileSync(pkgpath, pkg, 'utf8');
