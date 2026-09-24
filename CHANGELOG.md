# Changelog

## 1.7.0

### Added
- `texture_formats_tier1` storage texel formats (`rgba16unorm`, `r16snorm`, `rgb10a2uint`, ...).
- `swizzle_assignment`: chained, indexed, and compound swizzle assignments (`v.wz[0] = x`, `v.zw += y`).
- `WgslExec`/`WgslDebug` set the `global_invocation_index`, `workgroup_index`, `subgroup_id`, `num_subgroups`, `subgroup_size`, and `subgroup_invocation_id` builtins.

### Fixed
- The `rg11b10ufloat` texel format was spelled `rg11b10float`.
- Swizzle writes to struct members, array elements, matrix columns, and through `(*p)` were lost.
- `WgslExec` logged an error for `enable` and `requires` directives.

## 1.6.0

### Added
- `FunctionInfo.workgroupSize` reflects `@workgroup_size`, resolving consts and override defaults.
- `FunctionInfo.overrides` lists the overrides referenced by a function's attributes.
- Attribute values are evaluated as const expressions.
- Static shader cost model (`buildShaderCostTree`) for flame-graph style per-invocation cost estimates.
- GPU ground-truth tests comparing vertex, fragment, and texture results against WebGPU.

### Fixed
- `WgslDebug` now unwinds on a bare `return;` instead of continuing past it (#99).
- A `return` inside a function called as a statement no longer unwinds the whole entry point.
- `WgslExec.dispatchWorkgroups` binds `{ sampler: descriptor }` entries like `WgslDebug` (#100).
- Struct attributes were dropped by the parser and missing from reflection.
- Texture loads honor the texture view swizzle (#95).
- `discard` demotes the invocation to a helper instead of ending it, keeping quad derivatives correct.
- Resuming from a breakpoint no longer stops on the same line again; loop breakpoints still hit each iteration.
- Vertex stage debugging: uniform bindings, override constants, and `vertex_index` / `instance_index` in input structs.
- Fragment stage debugging: uniform bindings, `frag_depth` output, and `sample_index`.
- Texture builtins: `textureGather` footprint order, cube array face selection, 2d array mip selection, 3d `addressModeW` and depth filtering.

## 1.5.0

- Changelog starts at 1.6.0.
