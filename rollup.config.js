import typescript from "@rollup/plugin-typescript";

function build(format, file, sourcemap) {
    return {
        input: 'src/index.ts',
        plugins: [typescript()],
        output: [
            {
                format,
                file,
                sourcemap,
            }
        ]
    }
}

let builds = [
    build('esm', 'wgsl_reflect.module.js', true),
    build('cjs', 'wgsl_reflect.node.js', true),
];

export default builds;
