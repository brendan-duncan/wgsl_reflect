export function isArray(value: any): boolean {
    return Array.isArray(value) || value?.buffer instanceof ArrayBuffer;
}

export function isNumber(value: any): boolean {
    return typeof value === "number";
}
