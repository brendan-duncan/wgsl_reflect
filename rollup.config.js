import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";

function build(input, format, file, sourcemap) {
    return {
        input,
        plugins: [
            typescript(),
            terser({
                ecma: 2020,
                compress: {
                    module: true,
                    toplevel: true,
                    keep_classnames: true,
                    unsafe_arrows: true,
                    drop_console: false,
                    drop_debugger: false
                },
                output: { quote_style: 1 }
                })
        ],
        output: [ { format, file, sourcemap, } ]
    };
}

let builds = [
    build('src/index.ts', 'esm', 'wgsl_reflect.module.js', true),
    build('src/index.ts', 'cjs', 'wgsl_reflect.node.js', true)
];

export default builds;
