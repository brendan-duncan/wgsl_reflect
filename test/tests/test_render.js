// Ground-truth tests for the vertex and fragment debuggers.
//
// Every other render-stage test asserts against a hand-computed expectation.
// These run the *same* shader on a real WebGPU device and on the emulator and
// require the two to agree, which is the only check that catches an emulator
// and a test that are wrong in the same way.
//
// The color targets are rgba32float, so a fragment's returned vec4f arrives in
// the assertion unquantized.

import { test, group, webgpuRender, pixelCenterUVs } from "../test.js";
import { WgslDebug, debugFragmentQuad } from "../../wgsl_reflect.module.js";

// A triangle that covers the whole viewport, carrying uv = clip.xy * 0.5 + 0.5.
// Rendered into a 2x2 target it produces exactly one fragment quad whose
// interpolated uvs are pixelCenterUVs(2, 2).
const FULLSCREEN_VS = `
  struct VSOut {
    @builtin(position) pos: vec4f,
    @location(0) uv: vec2f,
  };
  @vertex fn vs(@builtin(vertex_index) vi: u32) -> VSOut {
    var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
    var out: VSOut;
    out.pos = vec4f(p[vi], 0.0, 1.0);
    out.uv = p[vi] * 0.5 + 0.5;
    return out;
  }`;

// Render `shader` over a 2x2 target and return the 4 fragments as [r,g,b,a]
// arrays in TL, TR, BL, BR order -- the order the quad debugger uses.
async function renderQuad(shader, bindGroups) {
  const pixels = await webgpuRender(shader, {
    vertexCount: 3, topology: "triangle-list", size: [2, 2], bindGroups,
  });
  const out = [];
  for (let i = 0; i < 4; ++i) {
    out.push(Array.from(pixels.subarray(i * 4, i * 4 + 4)));
  }
  return out;
}

// Two mip levels of a 1x1 rgba8unorm texture, so an implicit-LOD test can tell
// which mip the sampler picked.
const px = (r, g, b, a = 255) => [r, g, b, a];

export async function run() {
  await group("GPU Ground Truth: Vertex", async function () {
    await test("vertex stage output matches the GPU", async function (test) {
      // The varyings are flat-interpolated, so the fragment receives the
      // vertex stage's output bit-for-bit rather than an interpolated blend.
      const shader = `
        struct VSOut {
          @builtin(position) pos: vec4f,
          @location(0) @interpolate(flat) a: vec4f,
          @location(1) @interpolate(flat) b: vec4f,
        };
        struct FragOut {
          @location(0) a: vec4f,
          @location(1) b: vec4f,
        };
        @vertex fn vs(@builtin(vertex_index) vi: u32,
                      @builtin(instance_index) ii: u32,
                      @location(0) p: vec2f) -> VSOut {
          var out: VSOut;
          out.pos = vec4f(0.0, 0.0, 0.0, 1.0);
          out.a = vec4f(p * 3.0, f32(vi), f32(ii));
          out.b = vec4f(length(p), dot(p, p), p.y / p.x, fma(p.x, 2.0, 1.0));
          return out;
        }
        @fragment fn fs(@location(0) @interpolate(flat) a: vec4f,
                        @location(1) @interpolate(flat) b: vec4f) -> FragOut {
          var out: FragOut;
          out.a = a;
          out.b = b;
          return out;
        }`;

      // Four vertices; the draw selects index 3 with firstVertex, and
      // instance 2 with firstInstance, so both builtins carry a value the
      // debugger has to reproduce rather than defaulting to zero.
      const positions = new Float32Array([
        0.0, 0.0,
        0.1, 0.2,
        0.3, 0.4,
        1.5, -0.5, // vertex 3
      ]);
      const [gpuA, gpuB] = await webgpuRender(shader, {
        vertexCount: 1, firstVertex: 3, instanceCount: 1, firstInstance: 2,
        targetCount: 2,
        vertexBuffers: [{
          arrayStride: 8,
          attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
          data: positions,
        }],
      });

      const dbg = new WgslDebug(shader);
      test.true(dbg.debugVertex("vs", { vertex_index: 3, instance_index: 2, 0: [1.5, -0.5] }, {}),
        "debugVertex should succeed");
      while (dbg.stepNext());
      const out = dbg.getReturnValue();

      test.equals(out.a, Array.from(gpuA), 1e-6, `a: ${out.a} != ${gpuA}`);
      test.equals(out.b, Array.from(gpuB), 1e-6, `b: ${out.b} != ${gpuB}`);
    });

    await test("uniform buffer in the vertex stage matches the GPU", async function (test) {
      const shader = `
        struct Xform {
          scale: vec4f,
          offset: vec4f,
          count: u32,
        };
        @group(0) @binding(0) var<uniform> xf: Xform;
        struct VSOut {
          @builtin(position) pos: vec4f,
          @location(0) @interpolate(flat) v: vec4f,
        };
        @vertex fn vs(@location(0) p: vec2f) -> VSOut {
          var out: VSOut;
          out.pos = vec4f(0.0, 0.0, 0.0, 1.0);
          out.v = vec4f(p, 0.0, 1.0) * xf.scale + xf.offset + vec4f(f32(xf.count));
          return out;
        }
        @fragment fn fs(@location(0) @interpolate(flat) v: vec4f) -> @location(0) vec4f {
          return v;
        }`;

      // std140-ish layout: two vec4f then a u32 padded out to 16 bytes.
      const uniform = new Float32Array(12);
      uniform.set([2.0, 3.0, 4.0, 5.0], 0);   // scale
      uniform.set([0.5, -0.5, 1.5, -1.5], 4); // offset
      new Uint32Array(uniform.buffer, 32, 1)[0] = 7; // count

      const bg = { 0: { 0: { uniform } } };
      const positions = new Float32Array([1.25, -2.5]);
      const gpu = await webgpuRender(shader, {
        bindGroups: bg,
        vertexBuffers: [{
          arrayStride: 8,
          attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
          data: positions,
        }],
      });

      const dbg = new WgslDebug(shader);
      test.true(dbg.debugVertex("vs", { 0: [1.25, -2.5] }, bg), "debugVertex should succeed");
      while (dbg.stepNext());
      test.equals(dbg.getReturnValue().v, Array.from(gpu), 1e-6);
    });

    await test("storage buffer in the vertex stage matches the GPU", async function (test) {
      const shader = `
        @group(0) @binding(0) var<storage, read> weights: array<f32>;
        struct VSOut {
          @builtin(position) pos: vec4f,
          @location(0) @interpolate(flat) v: vec4f,
        };
        @vertex fn vs(@builtin(vertex_index) vi: u32) -> VSOut {
          var out: VSOut;
          out.pos = vec4f(0.0, 0.0, 0.0, 1.0);
          let n = arrayLength(&weights);
          out.v = vec4f(weights[vi], weights[vi + 1u], f32(n), 1.0);
          return out;
        }
        @fragment fn fs(@location(0) @interpolate(flat) v: vec4f) -> @location(0) vec4f {
          return v;
        }`;

      const weights = new Float32Array([10, 20, 30, 40]);
      const bg = { 0: { 0: weights } };
      const gpu = await webgpuRender(shader, { bindGroups: bg, vertexCount: 1, firstVertex: 1 });

      const dbg = new WgslDebug(shader);
      test.true(dbg.debugVertex("vs", { vertex_index: 1 }, bg), "debugVertex should succeed");
      while (dbg.stepNext());
      test.equals(dbg.getReturnValue().v, Array.from(gpu), 1e-6);
    });

    await test("attribute components conform the way GPU vertex fetch does", async function (test) {
      // A float32x3 buffer attribute feeding a vec4f shader input gets w = 1,
      // and a float32x2 attribute feeding an f32 input keeps only x. The
      // debugger conforms caller-supplied inputs the same way; this pins that
      // behavior to what the hardware actually does.
      const shader = `
        struct VSOut {
          @builtin(position) pos: vec4f,
          @location(0) @interpolate(flat) v: vec4f,
        };
        @vertex fn vs(@location(0) p: vec4f, @location(1) s: f32) -> VSOut {
          var out: VSOut;
          out.pos = vec4f(0.0, 0.0, 0.0, 1.0);
          out.v = p * s;
          return out;
        }
        @fragment fn fs(@location(0) @interpolate(flat) v: vec4f) -> @location(0) vec4f {
          return v;
        }`;

      const data = new Float32Array([1.0, 2.0, 3.0, /* s */ 2.0, 9.0]);
      const gpu = await webgpuRender(shader, {
        vertexBuffers: [{
          arrayStride: 20,
          attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x3" },
            { shaderLocation: 1, offset: 12, format: "float32x2" },
          ],
          data,
        }],
      });

      const dbg = new WgslDebug(shader);
      test.true(dbg.debugVertex("vs", { 0: [1.0, 2.0, 3.0], 1: [2.0, 9.0] }, {}),
        "debugVertex should succeed");
      while (dbg.stepNext());
      test.equals(dbg.getReturnValue().v, Array.from(gpu), 1e-6);
    });

    await test("integer attributes and builtins match the GPU", async function (test) {
      const shader = `
        struct VSOut {
          @builtin(position) pos: vec4f,
          @location(0) @interpolate(flat) v: vec4f,
        };
        @vertex fn vs(@location(0) i: i32, @location(1) u: u32,
                      @builtin(vertex_index) vi: u32) -> VSOut {
          var out: VSOut;
          out.pos = vec4f(0.0, 0.0, 0.0, 1.0);
          out.v = vec4f(f32(i * 2), f32(u / 2u), f32(i + i32(u)), f32(vi));
          return out;
        }
        @fragment fn fs(@location(0) @interpolate(flat) v: vec4f) -> @location(0) vec4f {
          return v;
        }`;

      const data = new Int32Array([-5, 9]);
      const gpu = await webgpuRender(shader, {
        vertexBuffers: [{
          arrayStride: 8,
          attributes: [
            { shaderLocation: 0, offset: 0, format: "sint32" },
            { shaderLocation: 1, offset: 4, format: "uint32" },
          ],
          data,
        }],
      });

      const dbg = new WgslDebug(shader);
      test.true(dbg.debugVertex("vs", { 0: -5, 1: 9, vertex_index: 0 }, {}),
        "debugVertex should succeed");
      while (dbg.stepNext());
      test.equals(dbg.getReturnValue().v, Array.from(gpu), 1e-6);
    });
  }, true);

  await group("GPU Ground Truth: Fragment", async function () {
    await test("single fragment invocation matches the GPU", async function (test) {
      const shader = `
        ${FULLSCREEN_VS}
        @fragment fn fs(@builtin(position) fragPos: vec4f, @location(0) uv: vec2f) -> @location(0) vec4f {
          let a = uv.x * uv.y;
          let b = sqrt(uv.x) + pow(uv.y, 3.0);
          return vec4f(a, b, fragPos.x, fragPos.y);
        }`;

      const gpu = await renderQuad(shader, {});
      const uvs = pixelCenterUVs(2, 2);
      // The fragment builtin position is the pixel center in framebuffer space.
      const positions = [[0.5, 0.5], [1.5, 0.5], [0.5, 1.5], [1.5, 1.5]];

      for (let i = 0; i < 4; ++i) {
        const dbg = new WgslDebug(shader);
        test.true(dbg.debugFragment("fs", {
          position: [positions[i][0], positions[i][1], 0.0, 1.0],
          0: uvs[i],
        }, {}), "debugFragment should succeed");
        while (dbg.stepNext());
        test.equals(dbg.getReturnValue(), gpu[i], 1e-6, `lane ${i}: got ${dbg.getReturnValue()} want ${gpu[i]}`);
      }
    });

    await test("multiple render targets match the GPU", async function (test) {
      const shader = `
        ${FULLSCREEN_VS}
        struct FragOut {
          @location(0) albedo: vec4f,
          @location(1) normal: vec4f,
        };
        @fragment fn fs(@location(0) uv: vec2f) -> FragOut {
          var out: FragOut;
          out.albedo = vec4f(uv, 0.5, 1.0);
          out.normal = vec4f(normalize(vec3f(uv, 1.0)), 0.0);
          return out;
        }`;

      const [t0, t1] = await webgpuRender(shader, {
        vertexCount: 3, topology: "triangle-list", size: [2, 2], targetCount: 2,
      });
      const uvs = pixelCenterUVs(2, 2);

      for (let i = 0; i < 4; ++i) {
        const dbg = new WgslDebug(shader);
        dbg.debugFragment("fs", { 0: uvs[i] }, {});
        while (dbg.stepNext());
        const out = dbg.getReturnValue();
        test.equals(out.albedo, Array.from(t0.subarray(i * 4, i * 4 + 4)), 1e-6);
        test.equals(out.normal, Array.from(t1.subarray(i * 4, i * 4 + 4)), 1e-6);
      }
    });

    await test("discard matches the GPU", async function (test) {
      // The target is cleared to 0, so a discarded fragment reads back as the
      // clear value while a kept one carries the shader's result.
      const shader = `
        ${FULLSCREEN_VS}
        @fragment fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
          if (uv.x < 0.5) { discard; }
          return vec4f(uv, 1.0, 1.0);
        }`;

      const gpu = await renderQuad(shader, {});
      const uvs = pixelCenterUVs(2, 2);

      for (let i = 0; i < 4; ++i) {
        const dbg = new WgslDebug(shader);
        dbg.debugFragment("fs", { 0: uvs[i] }, {});
        while (dbg.stepNext());
        if (dbg.discarded) {
          test.equals(gpu[i], [0, 0, 0, 0], `lane ${i} discarded but the GPU wrote ${gpu[i]}`);
        } else {
          test.equals(dbg.getReturnValue(), gpu[i], 1e-6, `lane ${i}`);
        }
      }
    });
  }, true);

  await group("GPU Ground Truth: Fragment Quad", async function () {
    await test("quad derivatives match the GPU", async function (test) {
      const shader = `
        ${FULLSCREEN_VS}
        @fragment fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
          let d = vec2f(dpdx(uv.x), dpdy(uv.y));
          return vec4f(d, fwidth(uv.x), length(vec2f(dpdx(uv.y), dpdy(uv.x))));
        }`;

      const gpu = await renderQuad(shader, {});
      const quad = pixelCenterUVs(2, 2).map((uv) => ({ 0: uv }));
      const r = debugFragmentQuad(shader, "fs", quad, {});
      test.equals(r.errors.length, 0, `quad errors: ${r.errors.join("; ")}`);
      for (let i = 0; i < 4; ++i) {
        test.equals(r.outputs[i], gpu[i], 1e-6, `lane ${i}: got ${r.outputs[i]} want ${gpu[i]}`);
      }
    });

    await test("implicit-LOD textureSample matches the GPU", async function (test) {
      // A 4x4 base mip of red over a 2x2 mip of green over a 1x1 mip of blue.
      // The uv spans the whole texture across a 2-pixel-wide quad, so the
      // sampler has to choose a coarse mip; which one is exactly what this
      // compares.
      const mip0 = new Uint8Array(4 * 4 * 4);
      for (let i = 0; i < 16; ++i) mip0.set(px(255, 0, 0), i * 4);
      const mip1 = new Uint8Array(2 * 2 * 4);
      for (let i = 0; i < 4; ++i) mip1.set(px(0, 255, 0), i * 4);
      const mip2 = new Uint8Array(px(0, 0, 255));

      const bg = {
        0: {
          0: {
            texture: [mip0.buffer, mip1.buffer, mip2.buffer],
            descriptor: { format: "rgba8unorm", size: [4, 4, 1], mipLevelCount: 3, dimension: "2d" },
          },
          1: { sampler: { magFilter: "linear", minFilter: "linear", mipmapFilter: "linear" } },
        },
      };

      const shader = `
        ${FULLSCREEN_VS}
        @group(0) @binding(0) var tex: texture_2d<f32>;
        @group(0) @binding(1) var samp: sampler;
        @fragment fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
          return textureSample(tex, samp, uv);
        }`;

      const gpu = await renderQuad(shader, bg);
      const quad = pixelCenterUVs(2, 2).map((uv) => ({ 0: uv }));
      const r = debugFragmentQuad(shader, "fs", quad, bg);
      test.equals(r.errors.length, 0, `quad errors: ${r.errors.join("; ")}`);
      for (let i = 0; i < 4; ++i) {
        test.equals(r.outputs[i], gpu[i], 1e-5, `lane ${i}: got ${r.outputs[i]} want ${gpu[i]}`);
      }
    });
  }, true);

  await group("GPU Ground Truth: Texture Dimensions", async function () {
    // One distinct color per cube face, in WebGPU's face order:
    // 0 +X, 1 -X, 2 +Y, 3 -Y, 4 +Z, 5 -Z.
    const FACE_COLORS = [
      px(255, 0, 0), px(0, 255, 0), px(0, 0, 255),
      px(255, 255, 0), px(255, 0, 255), px(0, 255, 255),
    ];

    await test("cube face selection matches the GPU", async function (test) {
      // 1x1 faces with nearest filtering, so the result is purely "which face
      // did this direction land on". Linear filtering would not work here: the
      // GPU filters cube maps seamlessly across face boundaries, which the
      // emulator does not model (it clamps within the face), so every texel of
      // a 1x1 face would be a cross-face blend.
      const faces = new Uint8Array(6 * 4);
      for (let f = 0; f < 6; ++f) {
        faces.set(FACE_COLORS[f], f * 4);
      }
      const bg = {
        0: {
          0: {
            texture: [faces.buffer],
            descriptor: { format: "rgba8unorm", size: [1, 1, 6], mipLevelCount: 1, dimension: "2d" },
            viewDimension: "cube",
          },
          1: { sampler: { magFilter: "nearest", minFilter: "nearest" } },
        },
      };

      // Each fragment picks a different axis direction from its uv, so one
      // 2x2 draw covers four of the six faces; the remaining two are covered
      // by the second draw below.
      const shader = (dirs) => `
        ${FULLSCREEN_VS}
        @group(0) @binding(0) var tex: texture_cube<f32>;
        @group(0) @binding(1) var samp: sampler;
        @fragment fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
          var dirs = array<vec3f, 4>(${dirs});
          let i = u32(uv.x * 2.0) + u32((1.0 - uv.y) * 2.0) * 2u;
          return textureSampleLevel(tex, samp, dirs[i], 0.0);
        }`;

      const batches = [
        "vec3f(1.0, 0.1, -0.2), vec3f(-1.0, 0.2, 0.1), vec3f(0.1, 1.0, 0.3), vec3f(0.2, -1.0, -0.1)",
        "vec3f(0.1, -0.2, 1.0), vec3f(-0.3, 0.1, -1.0), vec3f(0.9, 0.5, 0.4), vec3f(-0.4, -0.9, 0.3)",
      ];

      for (const dirs of batches) {
        const code = shader(dirs);
        const gpu = await renderQuad(code, bg);
        const quad = pixelCenterUVs(2, 2).map((uv) => ({ 0: uv }));
        const r = debugFragmentQuad(code, "fs", quad, bg);
        test.equals(r.errors.length, 0, `quad errors: ${r.errors.join("; ")}`);
        for (let i = 0; i < 4; ++i) {
          test.equals(r.outputs[i], gpu[i], 1e-5,
            `dir ${i} of [${dirs}]: got ${r.outputs[i]} want ${gpu[i]}`);
        }
      }
    });

    await test("cube face orientation matches the GPU", async function (test) {
      // 2x2 faces with four distinct texels each and a nearest-filter sampler:
      // now the *orientation* of the face-local coordinate is what is being
      // compared, which is where cube mapping usually goes wrong.
      const faces = new Uint8Array(6 * 2 * 2 * 4);
      for (let f = 0; f < 6; ++f) {
        for (let t = 0; t < 4; ++t) {
          // Encode the face in red and the texel index in green.
          faces.set(px(f * 40, t * 60, 128), (f * 4 + t) * 4);
        }
      }
      const bg = {
        0: {
          0: {
            texture: [faces.buffer],
            descriptor: { format: "rgba8unorm", size: [2, 2, 6], mipLevelCount: 1, dimension: "2d" },
            viewDimension: "cube",
          },
          1: { sampler: { magFilter: "nearest", minFilter: "nearest" } },
        },
      };

      // Directions well inside one quadrant of a face, so nearest sampling
      // lands on a single unambiguous texel.
      const dirs = "vec3f(1.0, 0.5, 0.5), vec3f(1.0, -0.5, -0.5), vec3f(0.5, 1.0, 0.5), vec3f(0.5, 0.5, 1.0)";
      const code = `
        ${FULLSCREEN_VS}
        @group(0) @binding(0) var tex: texture_cube<f32>;
        @group(0) @binding(1) var samp: sampler;
        @fragment fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
          var dirs = array<vec3f, 4>(${dirs});
          let i = u32(uv.x * 2.0) + u32((1.0 - uv.y) * 2.0) * 2u;
          return textureSampleLevel(tex, samp, dirs[i], 0.0);
        }`;

      const gpu = await renderQuad(code, bg);
      const quad = pixelCenterUVs(2, 2).map((uv) => ({ 0: uv }));
      const r = debugFragmentQuad(code, "fs", quad, bg);
      test.equals(r.errors.length, 0, `quad errors: ${r.errors.join("; ")}`);
      for (let i = 0; i < 4; ++i) {
        test.equals(r.outputs[i], gpu[i], 1e-5, `dir ${i}: got ${r.outputs[i]} want ${gpu[i]}`);
      }
    });

    await test("2d array layer selection matches the GPU", async function (test) {
      // 2x2 x 3 layers, one solid color per layer, nearest filtering.
      const layers = new Uint8Array(3 * 2 * 2 * 4);
      const layerColors = [px(255, 0, 0), px(0, 255, 0), px(0, 0, 255)];
      for (let l = 0; l < 3; ++l) {
        for (let t = 0; t < 4; ++t) {
          layers.set(layerColors[l], (l * 4 + t) * 4);
        }
      }
      const bg = {
        0: {
          0: {
            texture: [layers.buffer],
            descriptor: { format: "rgba8unorm", size: [2, 2, 3], mipLevelCount: 1, dimension: "2d" },
            viewDimension: "2d-array",
          },
          1: { sampler: { magFilter: "nearest", minFilter: "nearest" } },
        },
      };

      const code = `
        ${FULLSCREEN_VS}
        @group(0) @binding(0) var tex: texture_2d_array<f32>;
        @group(0) @binding(1) var samp: sampler;
        @fragment fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
          let layer = u32(uv.x * 2.0) + u32((1.0 - uv.y) * 2.0) * 2u;
          return textureSampleLevel(tex, samp, vec2f(0.25, 0.25), min(layer, 2u), 0.0);
        }`;

      const gpu = await renderQuad(code, bg);
      const quad = pixelCenterUVs(2, 2).map((uv) => ({ 0: uv }));
      const r = debugFragmentQuad(code, "fs", quad, bg);
      test.equals(r.errors.length, 0, `quad errors: ${r.errors.join("; ")}`);
      for (let i = 0; i < 4; ++i) {
        test.equals(r.outputs[i], gpu[i], 1e-5, `lane ${i}: got ${r.outputs[i]} want ${gpu[i]}`);
      }
    });

    await test("3d volume filtering matches the GPU", async function (test) {
      // 2x2x2: slice 0 is red, slice 1 is blue. Sampling in the middle of the
      // volume with linear filtering has to blend across the depth slices,
      // which is the path a 2d texture never exercises.
      const volume = new Uint8Array(2 * 2 * 2 * 4);
      for (let i = 0; i < 4; ++i) {
        volume.set(px(255, 0, 0), i * 4);
        volume.set(px(0, 0, 255), (4 + i) * 4);
      }
      const bg = {
        0: {
          0: {
            texture: [volume.buffer],
            descriptor: { format: "rgba8unorm", size: [2, 2, 2], mipLevelCount: 1, dimension: "3d" },
            viewDimension: "3d",
          },
          1: { sampler: { magFilter: "linear", minFilter: "linear" } },
        },
      };

      // Four different depth coordinates across the quad: fully in slice 0,
      // halfway, fully in slice 1, and a three-quarter blend.
      const code = `
        ${FULLSCREEN_VS}
        @group(0) @binding(0) var tex: texture_3d<f32>;
        @group(0) @binding(1) var samp: sampler;
        @fragment fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
          var w = array<f32, 4>(0.25, 0.5, 0.75, 0.625);
          let i = u32(uv.x * 2.0) + u32((1.0 - uv.y) * 2.0) * 2u;
          return textureSampleLevel(tex, samp, vec3f(0.5, 0.5, w[i]), 0.0);
        }`;

      const gpu = await renderQuad(code, bg);
      const quad = pixelCenterUVs(2, 2).map((uv) => ({ 0: uv }));
      const r = debugFragmentQuad(code, "fs", quad, bg);
      test.equals(r.errors.length, 0, `quad errors: ${r.errors.join("; ")}`);
      for (let i = 0; i < 4; ++i) {
        test.equals(r.outputs[i], gpu[i], 1e-5, `lane ${i}: got ${r.outputs[i]} want ${gpu[i]}`);
      }
    });

    // NOTE: depth-comparison sampling has no ground-truth test here. WebGPU
    // forbids writeTexture into the depth aspect of depth32float, so a shadow
    // map cannot be uploaded; producing one would take a separate depth-render
    // pass. The comparison path is covered by the hand-computed
    // "textureSampleCompare ..." tests in test_debug.js instead.
  }, true);
}
