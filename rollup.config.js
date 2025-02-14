import typescript from "@rollup/plugin-typescript";

function build(input, format, file, sourcemap) {
    return {
        input,
        plugins: [typescript()],
        output: [ { format, file, sourcemap, } ]
    };
}

let builds = [
    build('src/index.ts', 'esm', 'wgsl_reflect.module.js', true),
    build('src/index.ts', 'cjs', 'wgsl_reflect.node.js', true),
];

export default builds;
