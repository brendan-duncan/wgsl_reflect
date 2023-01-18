
export class Test {
    static isArray(obj) {
        return obj && (obj.constructor === Array || 
            (obj.buffer && obj.buffer.constructor === ArrayBuffer));
    }

    static isObject(obj) {
        return obj && obj.constructor === Object;
    }

    constructor() {
        this.state = true;
        this.messages = [];
        this._log = [];
    }

    log() {
        console.log(...arguments);
        this._log.push(Array.prototype.slice.call(arguments));
    }

    fail(message) {
        this.state = false;
        this.messages.push(message || "failed");
    }

    true(b, message) {
        if (!b) {
            this.state = false;
            this.messages.push(message || "!true");
        }
    }

    false(b, message) {
        if (b) {
            this.state = false;
            this.messages.push(message || "!false");
        }
    }

    _closeTo(a, b, e = 1.0e-6) {
        return Math.abs(b - a) <= e;
    }

    closeTo(a, b, e = 1.0e-6, message) {
        if (e.constructor === String) {
            message = e;
            e = 1.0e-6;
        }

        if (Test.isArray(a) && Test.isArray(b)) {
            let al = a.length;
            let bl = b.length;
            if (al != bl) {
                this.state = false;
                if (message) {
                    this.messages.push(message);
                } else {
                    this.messages.push(a, "!=", b);
                }
                return;
            }
            for (let i = 0, l = a.length; i < l; ++i) {
                if (!this._closeTo(a[i], b[i], e)) {
                    this.state = false;
                    if (message) {
                        this.messages.push(message);
                    } else {
                        this.messages.push(a, "!=", b);
                    }
                    return;
                }
            }
            return;
        }

        if (!this._closeTo(a, b, e)) {
            this.state = false;
            if (message) {
                this.messages.push(message);
            } else {
                this.messages.push(a, "!=", b);
            }
        }
    }

    objectEquals(a, b, message) {
        if (a !== b) {
            this.state = false;
            if (message) {
                this.messages.push(message);
            } else {
                this.messages.push(a, "!=", b);
            }
            return;
        }
    }

    objectNotEquals(a, b, message) {
        if (a === b) {
            this.state = false;
            if (message) {
                this.messages.push(message);
            } else {
                this.messages.push(a, "!=", b);
            }
            return;
        }
    }

    _error(message) {
        this.state = false;
        this.messages.push(message);
        return false;
    }

    validateObject(object, validator, message) {
        if (object === undefined || typeof(object) != typeof(validator)) {
            if (typeof(validator) == "string") {
                if (object) {
                    if (object.toString() == validator) {
                        return true;
                    }
                }
            }
            return this._error(message || `type mismatch ${typeof(object)} != ${typeof(validator)} : ${object} ${validator}`);
        }

        if (Test.isArray(object)) {
            if (!Test.isArray(validator)) {
                return this._error(message || `array mismatch`);
            }
            if (validator.length != object.length)  {
                return this._error(message || `array length mismatch: ${validator.length} != ${object.length}`);
            }
            for (let i = 0, l = validator.length; i < l; ++i) {
                if (!this.validateObject(object[i], validator[i]))
                    return false;
            }
            return true;
        }

        if (typeof(object) != "object") {
            if (object !== validator)
                return this._error(message || `value mismatch: ${object} != ${validator}`);
            return true;
        }

        for (let p in validator) {
            let gp = object[p];
            let vp = validator[p];
            if (!this.validateObject(gp, vp))
                return false;
        }

        return true;
    }

    equals(a, b, message) {
        if (a === b) {
            return;
        }
        if (Test.isArray(a) && Test.isArray(b)) {
            let al = a.length;
            let bl = b.length;
            if (al != bl) {
                this.state = false;
                if (message)
                    this.messages.push(message);
                else
                    this.messages.push(a.toString(), "!=", b.toString());
                return;
            }
            for (let i = 0, l = a.length; i < l; ++i) {
                if (a[i] != b[i]) {
                    this.state = false;
                    if (message)
                        this.messages.push(message);
                    else
                        this.messages.push(a, "!=", b);
                    return;
                }
            }
            return;
        }

        if (a != b) {
            this.state = false;
            if (message)
                this.messages.push(message);
            else
                this.messages.push(a, "!=", b);
        }
    }

    notEquals(a, b, message) {
        if (Test.isArray(a) && Test.isArray(b)) {
            if (a.length != b.length) {
                return;
            }
            let found = false;
            for (let i = 0, l = a.length; i < l; ++i) {
                if (a[i] != b[i]) {
                    found = true;
                }
            }
            if (!found) {
                this.state = false;
                if (message) {
                    this.messages.push(message);
                } else {
                    this.messages.push(a, "==", b);
                }
                return;
            }
            return;
        }
        if (a == b) {
            this.state = false;
            if (message) {
                this.messages.push(message);
            } else {
                this.messages.push(a, "==", b);
            }
        }
    }

    defined(a, message) {
        if (a === undefined) {
            this.state = false;
            this.messages.push(message || (a + " undefined"));
        }
    }

    undefined(a, message) {
        if (a !== undefined) {
            this.state = false;
            this.messages.push(message || (a + " defined"));
        }
    }

    isNull(a, message) {
        if (a !== undefined && a !== null) {
            this.state = false;
            this.messages.push(message || "expected null");
        }
    }

    notNull(a, message) {
        if (a === undefined || a === null) {
            this.state = false;
            this.messages.push(message || "expected not null");
        }
    }
}

export const __test = {
    totalTests: 0,
    totalFailed: 0,
};

let __group = {
    group: undefined,
    numTests: 0,
    testsFailed: 0,
};

export function group(name, f) {
    let div = document.createElement("div");
    div.className = "test_group";
    div.innerText = name;
    document.body.append(div);

    const group = {
        group: div,
        numTests: 0,
        testsFailed: 0,
    };

    __group = group;

    try {
        f();
    } catch (error) {
        div = document.createElement("div");
        div.className = "test_status_fail";
        div.innerText = `${error}`;
        document.body.appendChild(div);
    }

    div = document.createElement("div");
    document.body.appendChild(div);

    const numPassed = group.numTests - group.testsFailed;
    div.className = (group.testsFailed > 0) ? "test_status_fail" : "test_status_pass";
    div.innerText = `Tests: ${numPassed} / ${group.numTests}`;

    __test.totalTests += group.numTests;
    __test.totalFailed += group.testsFailed;
}

function _printLog(log) {
    const space = "<span class=\"test_log_space\"></span>";
    for (const l of log) {
        const div = document.createElement("div");
        div.className = "test_log";
        div.innerHTML = l.join(space);
        if (group.group !== undefined) {
            group.group.appendChild(div);
        } else {
            document.body.appendChild(div);
        }
    }
}

export function test(name, func) {
    const t = new Test();
    const group = __group;
    group.numTests++;

    try {
        func(t);
    } catch (error) {
        group.testsFailed++;
        const div = document.createElement("div");
        div.className = "test_fail";
        if (error.fileName != undefined) {
            div.innerText = `${name} FAILED: ${error.fileName}:${error.lineNumber}: ${error}`;
        } else {
            div.innerText = `${name} FAILED: ${error}`;
        }

        if (group.group !== undefined) {
            group.group.appendChild(div);
        } else {
            document.body.append(div);
        }

        _printLog(t._log);

        return;
    }

    let msg = "";
    if (!t.state) {
        group.testsFailed++;
        for (let m of t.messages) {
            msg += " : " + m;
        }
    }

    const div = document.createElement("div");
    div.className = t.state ? "test_pass" : "test_fail";
    div.innerText = `${name} ${t.state ? "PASSED" : "FAILED"}: ${msg}`;

    if (group.group != undefined) {
        group.group.appendChild(div);
    } else {
        document.body.append(div);
    }

    _printLog(t._log);
}

