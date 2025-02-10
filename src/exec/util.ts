export function isArray(value: any): boolean {
    return Array.isArray(value) || value?.buffer instanceof ArrayBuffer;
}
