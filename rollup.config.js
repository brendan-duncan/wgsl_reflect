import typescript from "@rollup/plugin-typescript";
import { nodeResolve } from "@rollup/plugin-node-resolve";

function build(input, format, file, sourcemap) {
    return {
        input,
        plugins: [typescript(), nodeResolve()],
        output: [ { format, file, sourcemap, } ]
    };
}

let builds = [
    build('src/index.ts', 'esm', 'wgsl_reflect.module.js', true),
    build('src/index.ts', 'cjs', 'wgsl_reflect.node.js', true),

    build('debugger/index.ts', 'esm', 'debugger/debugger.module.js', true),
];

export default builds;
