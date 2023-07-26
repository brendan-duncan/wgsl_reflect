import { assert, describe, expect, it } from 'vitest';
const { ok, equal, deepEqual, strictEqual } = assert;

import { WgslReflect } from '../src';

describe('struct_layout', () =>
{
    const shader = `
struct A {                                     //             align(8)  size(32)
    u: f32,                                    // offset(0)   align(4)  size(4)
    v: f32,                                    // offset(4)   align(4)  size(4)
    w: vec2<f32>,                              // offset(8)   align(8)  size(8)
    @size(16) x: f32                       // offset(16)  align(4)  size(16)
};

struct B {                           //             align(16) size(208)
    a: vec2<f32>,                              // offset(0)   align(8)  size(8)
    // -- implicit member alignment padding -- // offset(8)             size(8)
    b: vec3<f32>,                              // offset(16)  align(16) size(12)
    c: f32,                                    // offset(28)  align(4)  size(4)
    d: f32,                                    // offset(32)  align(4)  size(4)
    // -- implicit member alignment padding -- // offset(36)            size(12)
    @align(16) e: A,                        // offset(48)  align(16) size(32)
    f: vec3<f32>,                              // offset(80)  align(16) size(12)
    // -- implicit member alignment padding -- // offset(92)            size(4)
    g: @stride(32) array<A, 3>,             // offset(96)  align(8)  size(96)
    h: i32,                                    // offset(192) align(4)  size(4)
    // -- implicit struct size padding --      // offset(196)           size(12)
}

@group(0) @binding(0)
var<uniform> uniform_buffer: B;`;

    let reflect: WgslReflect;

    it('reflect', () =>
    {
        reflect = new WgslReflect(shader);
        equal(reflect.uniforms.length, 1);
        equal(reflect.structs.length, 2);
    });

    it('getMemberInfo(A)', () =>
    {
        const info = reflect.getTypeInfo(reflect.structs[0]);
        equal(info.align, 8);
        equal(info.size, 32);
    });

    it('getMemberInfo(B)', () =>
    {
        const info = reflect.getTypeInfo(reflect.structs[1]);
        equal(info.align, 16);
        equal(info.size, 208);
    });

    it('member offset/size', () =>
    {
        const info = reflect.getUniformBufferInfo(reflect.uniforms[0]);
        equal(info.size, 208);
    });
});
