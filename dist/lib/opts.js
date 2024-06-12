"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eachOption = void 0;
const eachOption = (data, _opts, iterfn) => {
    const opts = _opts;
    for (const k in opts) {
        const details = data[k];
        if (details == null) {
            console.warn('Warning: Ignoring unknown option', k);
            continue;
        }
        const { code, type } = details;
        const userVal = opts[k];
        switch (type) {
            case 'none':
                if (userVal !== true && userVal !== 1)
                    console.warn(`Warning: Ignoring value ${userVal} for option ${k}`);
                iterfn(details.code, null);
                break;
            case 'string':
            case 'bytes':
                iterfn(details.code, Buffer.from(userVal));
                break;
            case 'int':
                if (typeof userVal !== 'number')
                    console.warn('unexpected value for key', k, 'expected int');
                iterfn(details.code, userVal | 0);
                break;
        }
    }
};
exports.eachOption = eachOption;
//# sourceMappingURL=opts.js.map