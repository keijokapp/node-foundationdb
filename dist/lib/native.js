"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.type = exports.ErrorPredicate = void 0;
const os_1 = require("os");
const path = require("path");
const error_1 = require("./error");
var ErrorPredicate;
(function (ErrorPredicate) {
    ErrorPredicate[ErrorPredicate["Retryable"] = 50000] = "Retryable";
    ErrorPredicate[ErrorPredicate["MaybeCommitted"] = 50001] = "MaybeCommitted";
    ErrorPredicate[ErrorPredicate["RetryableNotCommitted"] = 50002] = "RetryableNotCommitted";
})(ErrorPredicate || (exports.ErrorPredicate = ErrorPredicate = {}));
// Will load a compiled build if present or a prebuild.
// If no build if found it will throw an exception
const rootDir = __dirname.endsWith(`dist${path.sep}lib`) // gross.
    ? path.resolve(`${__dirname}/../..`)
    : path.resolve(`${__dirname}/..`);
let mod;
try {
    mod = require('node-gyp-build')(rootDir);
}
catch (e) {
    console.error('Could not load native module. Make sure the foundationdb client is installed and');
    console.error('(on windows) in your PATH. https://www.foundationdb.org/download/');
    // This is way more involved than it needs to be, but error messages are important.
    if ((0, os_1.platform)() === 'darwin') {
        const ldLibraryPath = process.env['DYLD_LIBRARY_PATH'] || '';
        if (!ldLibraryPath.includes('/usr/local/lib')) {
            const configFile = process.env['SHELL'] === '/bin/zsh' ? '.zshrc' : '.bash_profile';
            console.error();
            console.error('MacOS note: You also need to set DYLD_LIBRARY_PATH="/usr/local/lib" due to notarization. Run:\n');
            console.error(`  echo \'export DYLD_LIBRARY_PATH="/usr/local/lib"\' >> ~/${configFile}`);
            console.error(`  source ~/${configFile}`);
            console.error('\nThen retry. See https://github.com/josephg/node-foundationdb/issues/42 for details.\n\n');
        }
    }
    throw e;
}
// Nan module no longer supported.
exports.type = 'napi';
mod.FDBError = error_1.default;
exports.default = mod;
//# sourceMappingURL=native.js.map