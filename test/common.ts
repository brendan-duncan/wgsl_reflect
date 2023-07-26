import { assert } from 'vitest';
const { ok, equal, deepEqual, strictEqual } = assert;

/**
 * 让T中以及所有键值中的所有键都是可选的
 */
export type gPartial<T> = {
    [P in keyof T]?: T[P] | gPartial<T[P]>;
};

export function validateObject<T>(actual: T, expected: gPartial<T>, message?: string)
{
    ok(validateObject1(actual, expected));
}

function validateObject1<T>(actual: T, expected: gPartial<T>)
{
    if (typeof expected === 'object' && typeof actual === 'object')
    {
        for (const key in expected)
        {
            if (!validateObject1(actual[key], expected[key] as any)) return false;
        }

        return true;
    }

    return actual === expected;
}
