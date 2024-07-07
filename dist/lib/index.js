"use strict";
// Stuff that hasn't been ported over:
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClusterSync = exports.createCluster = exports.openSync = exports.open = exports.configNetwork = exports.encoders = exports.directory = exports.tuple = exports.util = exports.ErrorPredicate = exports.ConflictRangeType = exports.MutationType = exports.StreamingMode = exports.TransactionOptionCode = exports.DatabaseOptionCode = exports.NetworkOptionCode = exports.DirectoryError = exports.DirectoryLayer = exports.Directory = exports.root = exports.Subspace = exports.Transaction = exports.Database = exports.keySelector = exports.FDBError = exports.stopNetworkSync = exports.modType = exports.setAPIVersion = void 0;
// const Transactional = require('./retryDecorator')
// const locality = require('./locality')
// const directory = require('./directory')
const native_1 = require("./native"), fdb = native_1;
const database_1 = require("./database");
const opts_1 = require("./opts");
const opts_g_1 = require("./opts.g");
const subspace_1 = require("./subspace");
const directory_1 = require("./directory");
const apiVersion = require("./apiVersion");
const util_1 = require("util");
// Must be called before fdb is initialized. Eg setAPIVersion(510).
var apiVersion_1 = require("./apiVersion");
Object.defineProperty(exports, "setAPIVersion", { enumerable: true, get: function () { return apiVersion_1.set; } });
// 'napi'
exports.modType = fdb.type;
let initCalled = false;
// This is called implicitly when the first cluster / db is opened.
const init = () => {
    if (apiVersion.get() == null) {
        throw Error('You must specify an API version to connect to FoundationDB. Eg: fdb.setAPIVersion(510);');
    }
    if (initCalled)
        return;
    initCalled = true;
    native_1.default.startNetwork();
    process.on('exit', () => native_1.default.stopNetwork());
};
// Destroy the network thread. This is not needed under normal circumstances;
// but can be used to de-init FDB.
exports.stopNetworkSync = native_1.default.stopNetwork;
var error_1 = require("./error");
Object.defineProperty(exports, "FDBError", { enumerable: true, get: function () { return error_1.default; } });
var keySelector_1 = require("./keySelector");
Object.defineProperty(exports, "keySelector", { enumerable: true, get: function () { return keySelector_1.default; } });
// These are exported to give consumers access to the type. Databases must
// always be constructed using open or via a cluster object.
var database_2 = require("./database");
Object.defineProperty(exports, "Database", { enumerable: true, get: function () { return database_2.default; } });
var transaction_1 = require("./transaction");
Object.defineProperty(exports, "Transaction", { enumerable: true, get: function () { return transaction_1.default; } });
var subspace_2 = require("./subspace");
Object.defineProperty(exports, "Subspace", { enumerable: true, get: function () { return subspace_2.default; } });
Object.defineProperty(exports, "root", { enumerable: true, get: function () { return subspace_2.root; } });
var directory_2 = require("./directory");
Object.defineProperty(exports, "Directory", { enumerable: true, get: function () { return directory_2.Directory; } });
Object.defineProperty(exports, "DirectoryLayer", { enumerable: true, get: function () { return directory_2.DirectoryLayer; } });
Object.defineProperty(exports, "DirectoryError", { enumerable: true, get: function () { return directory_2.DirectoryError; } });
var opts_g_2 = require("./opts.g");
Object.defineProperty(exports, "NetworkOptionCode", { enumerable: true, get: function () { return opts_g_2.NetworkOptionCode; } });
Object.defineProperty(exports, "DatabaseOptionCode", { enumerable: true, get: function () { return opts_g_2.DatabaseOptionCode; } });
Object.defineProperty(exports, "TransactionOptionCode", { enumerable: true, get: function () { return opts_g_2.TransactionOptionCode; } });
Object.defineProperty(exports, "StreamingMode", { enumerable: true, get: function () { return opts_g_2.StreamingMode; } });
Object.defineProperty(exports, "MutationType", { enumerable: true, get: function () { return opts_g_2.MutationType; } });
Object.defineProperty(exports, "ConflictRangeType", { enumerable: true, get: function () { return opts_g_2.ConflictRangeType; } });
Object.defineProperty(exports, "ErrorPredicate", { enumerable: true, get: function () { return opts_g_2.ErrorPredicate; } });
const util_2 = require("./util");
exports.util = { strInc: util_2.strInc };
const tuple = require("fdb-tuple");
exports.tuple = tuple;
// This must come after tuple is defined, above.
exports.directory = new directory_1.DirectoryLayer(); // Convenient root directory
const id = (x) => x;
exports.encoders = {
    int32BE: {
        pack(num) {
            const b = Buffer.allocUnsafe(4);
            b.writeInt32BE(num);
            return b;
        },
        unpack(buf) { return buf.readInt32BE(); }
    },
    json: {
        pack(obj) { return JSON.stringify(obj); },
        unpack(buf) { return JSON.parse(buf.toString('utf8')); }
    },
    string: {
        pack(str) { return Buffer.from(str, 'utf8'); },
        unpack(buf) { return buf.toString('utf8'); }
    },
    buf: {
        pack: id,
        unpack: id
    },
    // TODO: Move this into a separate library
    tuple: tuple,
};
// Can only be called before open() or openSync().
function configNetwork(netOpts) {
    if (initCalled)
        throw Error('configNetwork must be called before FDB connections are opened');
    (0, opts_1.eachOption)(opts_g_1.networkOptionData, netOpts, (code, val) => native_1.default.setNetworkOption(code, val));
}
exports.configNetwork = configNetwork;
/**
 * Opens a database and returns it.
 *
 * Note any network configuration must happen before the database is opened.
 */
function open(clusterFile, dbOpts) {
    init();
    const db = new database_1.default(native_1.default.createDatabase(clusterFile), subspace_1.root);
    if (dbOpts)
        db.setNativeOptions(dbOpts);
    return db;
}
exports.open = open;
// *** Some deprecated stuff to remove:
/** @deprecated This method will be removed in a future version. Call fdb.open() directly - it is syncronous too. */
exports.openSync = (0, util_1.deprecate)(open, 'This method will be removed in a future version. Call fdb.open() directly - it is syncronous too.');
// Previous versions of this library allowed you to create a cluster and then
// create database objects from it. This was all removed from the C API. We'll
// fake it for now, and remove this later.
const stubCluster = (clusterFile) => ({
    openDatabase(dbName = 'DB', opts) {
        return Promise.resolve(open(clusterFile, opts));
    },
    openDatabaseSync(dbName = 'DB', opts) {
        return open(clusterFile, opts);
    },
    close() { }
});
/** @deprecated FDB clusters have been removed from the API. Call open() directly to connect. */
exports.createCluster = (0, util_1.deprecate)((clusterFile) => {
    return Promise.resolve(stubCluster(clusterFile));
}, 'FDB clusters have been removed from the API. Call open() directly to connect.');
/** @deprecated FDB clusters have been removed from the API. Call open() directly to connect. */
exports.createClusterSync = (0, util_1.deprecate)((clusterFile) => {
    return stubCluster(clusterFile);
}, 'FDB clusters have been removed from the API. Call open() directly to connect.');
// TODO: Should I expose a method here for stopping the network for clean shutdown?
// I feel like I should.. but I'm not sure when its useful. Will the network thread
// keep the process running?
//# sourceMappingURL=index.js.map