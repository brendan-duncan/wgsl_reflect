import typescript from "@rollup/plugin-typescript";

function build(format, file) {
    return {
        input: 'src/index.ts',
        plugins: [typescript()],
        output: [
            {
                format,
                file,
                sourcemap: true,
            }
        ]
    }
}

let builds = [
    build('esm', 'wgsl_reflect.module.js'),
    build('cjs', 'wgsl_reflect.node.js'),
];

export default builds;
