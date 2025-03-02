import { TypeInfo } from '../reflect/info';

export const VectorTypeSize = {
    "vec2": 2, "vec2f": 2, "vec2i": 2, "vec2u": 2, "vec2b": 2, "vec2h": 2,
    "vec3": 3, "vec3f": 3, "vec3i": 3, "vec3u": 3, "vec3b": 3, "vec3h": 3,
    "vec4": 4, "vec4f": 4, "vec4i": 4, "vec4u": 4, "vec4b": 4, "vec4h": 4
};

export const MatrixTypeSize = {
    "mat2x2": [2, 2, 4], "mat2x2f": [2, 2, 4], "mat2x2h": [2, 2, 4],
    "mat2x3": [2, 3, 6], "mat2x3f": [2, 3, 6], "mat2x3h": [2, 3, 6],
    "mat2x4": [2, 4, 8], "mat2x4f": [2, 4, 8], "mat2x4h": [2, 4, 8],
    "mat3x2": [3, 2, 6], "mat3x2f": [3, 2, 6], "mat3x2h": [3, 2, 6],
    "mat3x3": [3, 3, 9], "mat3x3f": [3, 3, 9], "mat3x3h": [3, 3, 9],
    "mat3x4": [3, 4, 12], "mat3x4f": [3, 4, 12], "mat3x4h": [3, 4, 12],
    "mat4x2": [4, 2, 8], "mat4x2f": [4, 2, 8], "mat4x2h": [4, 2, 8],
    "mat4x3": [4, 3, 12], "mat4x3f": [4, 3, 12], "mat4x3h": [4, 3, 12],
    "mat4x4": [4, 4, 16], "mat4x4f": [4, 4, 16], "mat4x4h": [4, 4, 16]
};

export const MatrixTransposeType = {
    "mat2x2": "mat2x2", "mat2x2f": "mat2x2f", "mat2x2h": "mat2x2h",
    "mat2x3": "mat3x2", "mat2x3f": "mat3x2f", "mat2x3h": "mat3x2h",
    "mat2x4": "mat4x2", "mat2x4f": "mat4x2f", "mat2x4h": "mat4x2h",
    "mat3x2": "mat2x3", "mat3x2f": "mat2x3f", "mat3x2h": "mat2x3h",
    "mat3x3": "mat3x3", "mat3x3f": "mat3x3f", "mat3x3h": "mat3x3h",
    "mat3x4": "mat4x3", "mat3x4f": "mat4x3f", "mat3x4h": "mat4x3h",
    "mat4x2": "mat2x4", "mat4x2f": "mat2x4f", "mat4x2h": "mat2x4h",
    "mat4x3": "mat4x3", "mat4x3f": "mat4x3f", "mat4x3h": "mat4x3h",
    "mat4x4": "mat4x4", "mat4x4f": "mat4x4f", "mat4x4h": "mat4x4h"
};

export function matrixTranspose(matrix: number[], t: TypeInfo) {
    if (MatrixTypeSize[t.name] === undefined) {
        return null;
    }

    const cols = MatrixTypeSize[t.name][0];
    const rows = MatrixTypeSize[t.name][1];
    const result: number[] = [];

    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            result[i * rows + j] = matrix[j * cols + i];
        }
    }

    return result;
}

export function matrixMultiply(matrixA: number[], t1: TypeInfo, matrixB: number[], t2: TypeInfo): number[] | null {
  if (MatrixTypeSize[t1.name] === undefined || MatrixTypeSize[t2.name] === undefined) {
    return null;
  }

  const k = MatrixTypeSize[t1.name][0];
  const r = MatrixTypeSize[t1.name][1];
  const c = MatrixTypeSize[t2.name][0];
  const k2 = MatrixTypeSize[t2.name][1];

  if (k !== k2) {
    return null;
  }

  const result: number[] = new Array(c * r);

  for (let j = 0; j < r; j++) { // Iterate through columns of result
    for (let i = 0; i < c; i++) { // Iterate through rows of result
      let sum = 0;
      for (let l = 0; l < k; l++) {
        sum += matrixA[l * r + j] * matrixB[i * k + l]; // Access column-major elements
      }
      result[j * c + i] = sum; // Store in column-major order
    }
  }

  return result;
}

export function matrixVectorMultiply(matrix: number[], t1: TypeInfo, vector: number[], t2: TypeInfo): number[] | null {
  if (MatrixTypeSize[t1.name] === undefined || VectorTypeSize[t2.name] === undefined) {
    return null;
  }

  const cols = MatrixTypeSize[t1.name][0];
  const rows = MatrixTypeSize[t1.name][1];
  
  if (cols !== vector.length) {
    return null;
  }

  const resultVec = new Array(rows);
  // Perform matrix-vector multiplication (column-major)
  for (let i = 0; i < rows; i++) {
    let sum = 0;
    for (let j = 0; j < cols; j++) {
      sum += matrix[j * rows + i] * vector[j]; // Access column-major element
    }
    resultVec[i] = sum;
  }

  return resultVec;
}

export function vectorMatrixMultiply(vector: number[], t1: TypeInfo, matrix: number[], t2: TypeInfo): number[] | null {
  if (VectorTypeSize[t1.name] === undefined || MatrixTypeSize[t2.name] === undefined) {
    return null;
  }

  const cols = MatrixTypeSize[t2.name][0];
  const rows = MatrixTypeSize[t2.name][1];

  if (rows !== vector.length) {
    return null;
  }

  const result: number[] = [];
  for (let j = 0; j < cols; j++) {
    let sum = 0;
    for (let i = 0; i < rows; i++) {
      sum += vector[i] * matrix[i * cols + j];
    }
    result[j] = sum;
  }

  return result;
}
