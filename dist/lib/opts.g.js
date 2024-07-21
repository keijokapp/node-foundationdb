"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionOptionData = exports.databaseOptionData = exports.networkOptionData = exports.ErrorPredicate = exports.ConflictRangeType = exports.MutationType = exports.StreamingMode = exports.TransactionOptionCode = exports.DatabaseOptionCode = exports.NetworkOptionCode = void 0;
var NetworkOptionCode;
(function (NetworkOptionCode) {
    // DEPRECATED
    NetworkOptionCode[NetworkOptionCode["LocalAddress"] = 10] = "LocalAddress";
    // DEPRECATED
    NetworkOptionCode[NetworkOptionCode["ClusterFile"] = 20] = "ClusterFile";
    /**
     * Enables trace output to a file in a directory of the clients choosing
     */
    NetworkOptionCode[NetworkOptionCode["TraceEnable"] = 30] = "TraceEnable";
    /**
     * Sets the maximum size in bytes of a single trace output file. This
     * value should be in the range ``[0, INT64_MAX]``. If the value is set
     * to 0, there is no limit on individual file size. The default is a
     * maximum size of 10,485,760 bytes.
     */
    NetworkOptionCode[NetworkOptionCode["TraceRollSize"] = 31] = "TraceRollSize";
    /**
     * Sets the maximum size of all the trace output files put together. This
     * value should be in the range ``[0, INT64_MAX]``. If the value is set
     * to 0, there is no limit on the total size of the files. The default is
     * a maximum size of 104,857,600 bytes. If the default roll size is used,
     * this means that a maximum of 10 trace files will be written at a time.
     */
    NetworkOptionCode[NetworkOptionCode["TraceMaxLogsSize"] = 32] = "TraceMaxLogsSize";
    /**
     * Sets the 'LogGroup' attribute with the specified value for all events
     * in the trace output files. The default log group is 'default'.
     */
    NetworkOptionCode[NetworkOptionCode["TraceLogGroup"] = 33] = "TraceLogGroup";
    /**
     * Select the format of the log files. xml (the default) and json are
     * supported.
     */
    NetworkOptionCode[NetworkOptionCode["TraceFormat"] = 34] = "TraceFormat";
    /**
     * Select clock source for trace files. now (the default) or realtime are
     * supported.
     */
    NetworkOptionCode[NetworkOptionCode["TraceClockSource"] = 35] = "TraceClockSource";
    /**
     * Once provided, this string will be used to replace the port/PID in the
     * log file names.
     */
    NetworkOptionCode[NetworkOptionCode["TraceFileIdentifier"] = 36] = "TraceFileIdentifier";
    /**
     * Use the same base trace file name for all client threads as it did
     * before version 7.2. The current default behavior is to use distinct
     * trace file names for client threads by including their version and
     * thread index.
     */
    NetworkOptionCode[NetworkOptionCode["TraceShareAmongClientThreads"] = 37] = "TraceShareAmongClientThreads";
    /**
     * Set file suffix for partially written log files.
     */
    NetworkOptionCode[NetworkOptionCode["TracePartialFileSuffix"] = 39] = "TracePartialFileSuffix";
    /**
     * Set internal tuning or debugging knobs
     */
    NetworkOptionCode[NetworkOptionCode["Knob"] = 40] = "Knob";
    // DEPRECATED
    NetworkOptionCode[NetworkOptionCode["TLSPlugin"] = 41] = "TLSPlugin";
    /**
     * Set the certificate chain
     */
    NetworkOptionCode[NetworkOptionCode["TLSCertBytes"] = 42] = "TLSCertBytes";
    /**
     * Set the file from which to load the certificate chain
     */
    NetworkOptionCode[NetworkOptionCode["TLSCertPath"] = 43] = "TLSCertPath";
    /**
     * Set the private key corresponding to your own certificate
     */
    NetworkOptionCode[NetworkOptionCode["TLSKeyBytes"] = 45] = "TLSKeyBytes";
    /**
     * Set the file from which to load the private key corresponding to your
     * own certificate
     */
    NetworkOptionCode[NetworkOptionCode["TLSKeyPath"] = 46] = "TLSKeyPath";
    /**
     * Set the peer certificate field verification criteria
     */
    NetworkOptionCode[NetworkOptionCode["TLSVerifyPeers"] = 47] = "TLSVerifyPeers";
    NetworkOptionCode[NetworkOptionCode["BuggifyEnable"] = 48] = "BuggifyEnable";
    NetworkOptionCode[NetworkOptionCode["BuggifyDisable"] = 49] = "BuggifyDisable";
    /**
     * Set the probability of a BUGGIFY section being active for the current
     * execution.  Only applies to code paths first traversed AFTER this
     * option is changed.
     */
    NetworkOptionCode[NetworkOptionCode["BuggifySectionActivatedProbability"] = 50] = "BuggifySectionActivatedProbability";
    /**
     * Set the probability of an active BUGGIFY section being fired
     */
    NetworkOptionCode[NetworkOptionCode["BuggifySectionFiredProbability"] = 51] = "BuggifySectionFiredProbability";
    /**
     * Set the ca bundle
     */
    NetworkOptionCode[NetworkOptionCode["TLSCaBytes"] = 52] = "TLSCaBytes";
    /**
     * Set the file from which to load the certificate authority bundle
     */
    NetworkOptionCode[NetworkOptionCode["TLSCaPath"] = 53] = "TLSCaPath";
    /**
     * Set the passphrase for encrypted private key. Password should be set
     * before setting the key for the password to be used.
     */
    NetworkOptionCode[NetworkOptionCode["TLSPassword"] = 54] = "TLSPassword";
    /**
     * Disables the multi-version client API and instead uses the local
     * client directly. Must be set before setting up the network.
     */
    NetworkOptionCode[NetworkOptionCode["DisableMultiVersionClientApi"] = 60] = "DisableMultiVersionClientApi";
    /**
     * If set, callbacks from external client libraries can be called from
     * threads created by the FoundationDB client library. Otherwise,
     * callbacks will be called from either the thread used to add the
     * callback or the network thread. Setting this option can improve
     * performance when connected using an external client, but may not be
     * safe to use in all environments. Must be set before setting up the
     * network. WARNING: This feature is considered experimental at this
     * time.
     */
    NetworkOptionCode[NetworkOptionCode["CallbacksOnExternalThreads"] = 61] = "CallbacksOnExternalThreads";
    /**
     * Adds an external client library for use by the multi-version client
     * API. Must be set before setting up the network.
     */
    NetworkOptionCode[NetworkOptionCode["ExternalClientLibrary"] = 62] = "ExternalClientLibrary";
    /**
     * Searches the specified path for dynamic libraries and adds them to the
     * list of client libraries for use by the multi-version client API. Must
     * be set before setting up the network.
     */
    NetworkOptionCode[NetworkOptionCode["ExternalClientDirectory"] = 63] = "ExternalClientDirectory";
    /**
     * Prevents connections through the local client, allowing only
     * connections through externally loaded client libraries.
     */
    NetworkOptionCode[NetworkOptionCode["DisableLocalClient"] = 64] = "DisableLocalClient";
    /**
     * Spawns multiple worker threads for each version of the client that is
     * loaded.  Setting this to a number greater than one implies
     * disable_local_client.
     */
    NetworkOptionCode[NetworkOptionCode["ClientThreadsPerVersion"] = 65] = "ClientThreadsPerVersion";
    /**
     * Adds an external client library to be used with a future version
     * protocol. This option can be used testing purposes only!
     */
    NetworkOptionCode[NetworkOptionCode["FutureVersionClientLibrary"] = 66] = "FutureVersionClientLibrary";
    /**
     * Disables logging of client statistics, such as sampled transaction
     * activity.
     */
    NetworkOptionCode[NetworkOptionCode["DisableClientStatisticsLogging"] = 70] = "DisableClientStatisticsLogging";
    // DEPRECATED
    NetworkOptionCode[NetworkOptionCode["EnableSlowTaskProfiling"] = 71] = "EnableSlowTaskProfiling";
    /**
     * Enables debugging feature to perform run loop profiling. Requires
     * trace logging to be enabled. WARNING: this feature is not recommended
     * for use in production.
     */
    NetworkOptionCode[NetworkOptionCode["EnableRunLoopProfiling"] = 71] = "EnableRunLoopProfiling";
    /**
     * Prevents the multi-version client API from being disabled, even if no
     * external clients are configured. This option is required to use GRV
     * caching.
     */
    NetworkOptionCode[NetworkOptionCode["DisableClientBypass"] = 72] = "DisableClientBypass";
    /**
     * Enable client buggify - will make requests randomly fail (intended for
     * client testing)
     */
    NetworkOptionCode[NetworkOptionCode["ClientBuggifyEnable"] = 80] = "ClientBuggifyEnable";
    /**
     * Disable client buggify
     */
    NetworkOptionCode[NetworkOptionCode["ClientBuggifyDisable"] = 81] = "ClientBuggifyDisable";
    /**
     * Set the probability of a CLIENT_BUGGIFY section being active for the
     * current execution.
     */
    NetworkOptionCode[NetworkOptionCode["ClientBuggifySectionActivatedProbability"] = 82] = "ClientBuggifySectionActivatedProbability";
    /**
     * Set the probability of an active CLIENT_BUGGIFY section being fired. A
     * section will only fire if it was activated
     */
    NetworkOptionCode[NetworkOptionCode["ClientBuggifySectionFiredProbability"] = 83] = "ClientBuggifySectionFiredProbability";
    /**
     * Set a tracer to run on the client. Should be set to the same value as
     * the tracer set on the server.
     */
    NetworkOptionCode[NetworkOptionCode["DistributedClientTracer"] = 90] = "DistributedClientTracer";
    /**
     * Sets the directory for storing temporary files created by FDB client,
     * such as temporary copies of client libraries. Defaults to /tmp
     */
    NetworkOptionCode[NetworkOptionCode["ClientTmpDir"] = 91] = "ClientTmpDir";
    /**
     * This option is set automatically to communicate the list of supported
     * clients to the active client.
     */
    NetworkOptionCode[NetworkOptionCode["SupportedClientVersions"] = 1000] = "SupportedClientVersions";
    /**
     * This option is set automatically on all clients loaded externally
     * using the multi-version API.
     */
    NetworkOptionCode[NetworkOptionCode["ExternalClient"] = 1001] = "ExternalClient";
    /**
     * This option tells a child on a multiversion client what transport ID
     * to use.
     */
    NetworkOptionCode[NetworkOptionCode["ExternalClientTransportId"] = 1002] = "ExternalClientTransportId";
})(NetworkOptionCode || (exports.NetworkOptionCode = NetworkOptionCode = {}));
var DatabaseOptionCode;
(function (DatabaseOptionCode) {
    /**
     * Set the size of the client location cache. Raising this value can
     * boost performance in very large databases where clients access data in
     * a near-random pattern. Defaults to 100000.
     */
    DatabaseOptionCode[DatabaseOptionCode["LocationCacheSize"] = 10] = "LocationCacheSize";
    /**
     * Set the maximum number of watches allowed to be outstanding on a
     * database connection. Increasing this number could result in increased
     * resource usage. Reducing this number will not cancel any outstanding
     * watches. Defaults to 10000 and cannot be larger than 1000000.
     */
    DatabaseOptionCode[DatabaseOptionCode["MaxWatches"] = 20] = "MaxWatches";
    /**
     * Specify the machine ID that was passed to fdbserver processes running
     * on the same machine as this client, for better location-aware load
     * balancing.
     */
    DatabaseOptionCode[DatabaseOptionCode["MachineId"] = 21] = "MachineId";
    /**
     * Specify the datacenter ID that was passed to fdbserver processes
     * running in the same datacenter as this client, for better
     * location-aware load balancing.
     */
    DatabaseOptionCode[DatabaseOptionCode["DatacenterId"] = 22] = "DatacenterId";
    /**
     * Snapshot read operations will see the results of writes done in the
     * same transaction. This is the default behavior.
     */
    DatabaseOptionCode[DatabaseOptionCode["SnapshotRywEnable"] = 26] = "SnapshotRywEnable";
    /**
     * Snapshot read operations will not see the results of writes done in
     * the same transaction. This was the default behavior prior to API
     * version 300.
     */
    DatabaseOptionCode[DatabaseOptionCode["SnapshotRywDisable"] = 27] = "SnapshotRywDisable";
    /**
     * Sets the maximum escaped length of key and value fields to be logged
     * to the trace file via the LOG_TRANSACTION option. This sets the
     * ``transaction_logging_max_field_length`` option of each transaction
     * created by this database. See the transaction option description for
     * more information.
     */
    DatabaseOptionCode[DatabaseOptionCode["TransactionLoggingMaxFieldLength"] = 405] = "TransactionLoggingMaxFieldLength";
    /**
     * Set a timeout in milliseconds which, when elapsed, will cause each
     * transaction automatically to be cancelled. This sets the ``timeout``
     * option of each transaction created by this database. See the
     * transaction option description for more information. Using this option
     * requires that the API version is 610 or higher.
     */
    DatabaseOptionCode[DatabaseOptionCode["TransactionTimeout"] = 500] = "TransactionTimeout";
    /**
     * Set a maximum number of retries after which additional calls to
     * ``onError`` will throw the most recently seen error code. This sets
     * the ``retry_limit`` option of each transaction created by this
     * database. See the transaction option description for more information.
     */
    DatabaseOptionCode[DatabaseOptionCode["TransactionRetryLimit"] = 501] = "TransactionRetryLimit";
    /**
     * Set the maximum amount of backoff delay incurred in the call to
     * ``onError`` if the error is retryable. This sets the
     * ``max_retry_delay`` option of each transaction created by this
     * database. See the transaction option description for more information.
     */
    DatabaseOptionCode[DatabaseOptionCode["TransactionMaxRetryDelay"] = 502] = "TransactionMaxRetryDelay";
    /**
     * Set the maximum transaction size in bytes. This sets the
     * ``size_limit`` option on each transaction created by this database.
     * See the transaction option description for more information.
     */
    DatabaseOptionCode[DatabaseOptionCode["TransactionSizeLimit"] = 503] = "TransactionSizeLimit";
    /**
     * The read version will be committed, and usually will be the latest
     * committed, but might not be the latest committed in the event of a
     * simultaneous fault and misbehaving clock.
     */
    DatabaseOptionCode[DatabaseOptionCode["TransactionCausalReadRisky"] = 504] = "TransactionCausalReadRisky";
    /**
     * Deprecated. Addresses returned by get_addresses_for_key include the
     * port when enabled. As of api version 630, this option is enabled by
     * default and setting this has no effect.
     */
    DatabaseOptionCode[DatabaseOptionCode["TransactionIncludePortInAddress"] = 505] = "TransactionIncludePortInAddress";
    /**
     * Set a random idempotency id for all transactions. See the transaction
     * option description for more information. This feature is in
     * development and not ready for general use.
     */
    DatabaseOptionCode[DatabaseOptionCode["TransactionAutomaticIdempotency"] = 506] = "TransactionAutomaticIdempotency";
    /**
     * Allows ``get`` operations to read from sections of keyspace that have
     * become unreadable because of versionstamp operations. This sets the
     * ``bypass_unreadable`` option of each transaction created by this
     * database. See the transaction option description for more information.
     */
    DatabaseOptionCode[DatabaseOptionCode["TransactionBypassUnreadable"] = 700] = "TransactionBypassUnreadable";
    /**
     * Use configuration database.
     */
    DatabaseOptionCode[DatabaseOptionCode["UseConfigDatabase"] = 800] = "UseConfigDatabase";
    /**
     * An integer between 0 and 100 (default is 0) expressing the probability
     * that a client will verify it can't read stale data whenever it detects
     * a recovery.
     */
    DatabaseOptionCode[DatabaseOptionCode["TestCausalReadRisky"] = 900] = "TestCausalReadRisky";
})(DatabaseOptionCode || (exports.DatabaseOptionCode = DatabaseOptionCode = {}));
var TransactionOptionCode;
(function (TransactionOptionCode) {
    /**
     * The transaction, if not self-conflicting, may be committed a second
     * time after commit succeeds, in the event of a fault
     */
    TransactionOptionCode[TransactionOptionCode["CausalWriteRisky"] = 10] = "CausalWriteRisky";
    /**
     * The read version will be committed, and usually will be the latest
     * committed, but might not be the latest committed in the event of a
     * simultaneous fault and misbehaving clock.
     */
    TransactionOptionCode[TransactionOptionCode["CausalReadRisky"] = 20] = "CausalReadRisky";
    TransactionOptionCode[TransactionOptionCode["CausalReadDisable"] = 21] = "CausalReadDisable";
    /**
     * Addresses returned by get_addresses_for_key include the port when
     * enabled. As of api version 630, this option is enabled by default and
     * setting this has no effect.
     */
    TransactionOptionCode[TransactionOptionCode["IncludePortInAddress"] = 23] = "IncludePortInAddress";
    /**
     * The next write performed on this transaction will not generate a write
     * conflict range. As a result, other transactions which read the key(s)
     * being modified by the next write will not conflict with this
     * transaction. Care needs to be taken when using this option on a
     * transaction that is shared between multiple threads. When setting this
     * option, write conflict ranges will be disabled on the next write
     * operation, regardless of what thread it is on.
     */
    TransactionOptionCode[TransactionOptionCode["NextWriteNoWriteConflictRange"] = 30] = "NextWriteNoWriteConflictRange";
    /**
     * Committing this transaction will bypass the normal load balancing
     * across commit proxies and go directly to the specifically nominated
     * 'first commit proxy'.
     */
    TransactionOptionCode[TransactionOptionCode["CommitOnFirstProxy"] = 40] = "CommitOnFirstProxy";
    TransactionOptionCode[TransactionOptionCode["CheckWritesEnable"] = 50] = "CheckWritesEnable";
    /**
     * Reads performed by a transaction will not see any prior mutations that
     * occured in that transaction, instead seeing the value which was in the
     * database at the transaction's read version. This option may provide a
     * small performance benefit for the client, but also disables a number
     * of client-side optimizations which are beneficial for transactions
     * which tend to read and write the same keys within a single
     * transaction. It is an error to set this option after performing any
     * reads or writes on the transaction.
     */
    TransactionOptionCode[TransactionOptionCode["ReadYourWritesDisable"] = 51] = "ReadYourWritesDisable";
    // DEPRECATED
    TransactionOptionCode[TransactionOptionCode["ReadAheadDisable"] = 52] = "ReadAheadDisable";
    TransactionOptionCode[TransactionOptionCode["DurabilityDatacenter"] = 110] = "DurabilityDatacenter";
    TransactionOptionCode[TransactionOptionCode["DurabilityRisky"] = 120] = "DurabilityRisky";
    // DEPRECATED
    TransactionOptionCode[TransactionOptionCode["DurabilityDevNullIsWebScale"] = 130] = "DurabilityDevNullIsWebScale";
    /**
     * Specifies that this transaction should be treated as highest priority
     * and that lower priority transactions should block behind this one. Use
     * is discouraged outside of low-level tools
     */
    TransactionOptionCode[TransactionOptionCode["PrioritySystemImmediate"] = 200] = "PrioritySystemImmediate";
    /**
     * Specifies that this transaction should be treated as low priority and
     * that default priority transactions will be processed first. Batch
     * priority transactions will also be throttled at load levels smaller
     * than for other types of transactions and may be fully cut off in the
     * event of machine failures. Useful for doing batch work simultaneously
     * with latency-sensitive work
     */
    TransactionOptionCode[TransactionOptionCode["PriorityBatch"] = 201] = "PriorityBatch";
    /**
     * This is a write-only transaction which sets the initial configuration.
     * This option is designed for use by database system tools only.
     */
    TransactionOptionCode[TransactionOptionCode["InitializeNewDatabase"] = 300] = "InitializeNewDatabase";
    /**
     * Allows this transaction to read and modify system keys (those that
     * start with the byte 0xFF). Implies raw_access.
     */
    TransactionOptionCode[TransactionOptionCode["AccessSystemKeys"] = 301] = "AccessSystemKeys";
    /**
     * Allows this transaction to read system keys (those that start with the
     * byte 0xFF). Implies raw_access.
     */
    TransactionOptionCode[TransactionOptionCode["ReadSystemKeys"] = 302] = "ReadSystemKeys";
    /**
     * Allows this transaction to access the raw key-space when tenant mode
     * is on.
     */
    TransactionOptionCode[TransactionOptionCode["RawAccess"] = 303] = "RawAccess";
    TransactionOptionCode[TransactionOptionCode["DebugDump"] = 400] = "DebugDump";
    TransactionOptionCode[TransactionOptionCode["DebugRetryLogging"] = 401] = "DebugRetryLogging";
    // DEPRECATED
    TransactionOptionCode[TransactionOptionCode["TransactionLoggingEnable"] = 402] = "TransactionLoggingEnable";
    /**
     * Sets a client provided identifier for the transaction that will be
     * used in scenarios like tracing or profiling. Client trace logging or
     * transaction profiling must be separately enabled.
     */
    TransactionOptionCode[TransactionOptionCode["DebugTransactionIdentifier"] = 403] = "DebugTransactionIdentifier";
    /**
     * Enables tracing for this transaction and logs results to the client
     * trace logs. The DEBUG_TRANSACTION_IDENTIFIER option must be set before
     * using this option, and client trace logging must be enabled to get log
     * output.
     */
    TransactionOptionCode[TransactionOptionCode["LogTransaction"] = 404] = "LogTransaction";
    /**
     * Sets the maximum escaped length of key and value fields to be logged
     * to the trace file via the LOG_TRANSACTION option, after which the
     * field will be truncated. A negative value disables truncation.
     */
    TransactionOptionCode[TransactionOptionCode["TransactionLoggingMaxFieldLength"] = 405] = "TransactionLoggingMaxFieldLength";
    /**
     * Sets an identifier for server tracing of this transaction. When
     * committed, this identifier triggers logging when each part of the
     * transaction authority encounters it, which is helpful in diagnosing
     * slowness in misbehaving clusters. The identifier is randomly
     * generated. When there is also a debug_transaction_identifier, both IDs
     * are logged together.
     */
    TransactionOptionCode[TransactionOptionCode["ServerRequestTracing"] = 406] = "ServerRequestTracing";
    /**
     * Set a timeout in milliseconds which, when elapsed, will cause the
     * transaction automatically to be cancelled. Valid parameter values are
     * ``[0, INT_MAX]``. If set to 0, will disable all timeouts. All pending
     * and any future uses of the transaction will throw an exception. The
     * transaction can be used again after it is reset. Prior to API version
     * 610, like all other transaction options, the timeout must be reset
     * after a call to ``onError``. If the API version is 610 or greater, the
     * timeout is not reset after an ``onError`` call. This allows the user
     * to specify a longer timeout on specific transactions than the default
     * timeout specified through the ``transaction_timeout`` database option
     * without the shorter database timeout cancelling transactions that
     * encounter a retryable error. Note that at all API versions, it is safe
     * and legal to set the timeout each time the transaction begins, so most
     * code written assuming the older behavior can be upgraded to the newer
     * behavior without requiring any modification, and the caller is not
     * required to implement special logic in retry loops to only
     * conditionally set this option.
     */
    TransactionOptionCode[TransactionOptionCode["Timeout"] = 500] = "Timeout";
    /**
     * Set a maximum number of retries after which additional calls to
     * ``onError`` will throw the most recently seen error code. Valid
     * parameter values are ``[-1, INT_MAX]``. If set to -1, will disable the
     * retry limit. Prior to API version 610, like all other transaction
     * options, the retry limit must be reset after a call to ``onError``. If
     * the API version is 610 or greater, the retry limit is not reset after
     * an ``onError`` call. Note that at all API versions, it is safe and
     * legal to set the retry limit each time the transaction begins, so most
     * code written assuming the older behavior can be upgraded to the newer
     * behavior without requiring any modification, and the caller is not
     * required to implement special logic in retry loops to only
     * conditionally set this option.
     */
    TransactionOptionCode[TransactionOptionCode["RetryLimit"] = 501] = "RetryLimit";
    /**
     * Set the maximum amount of backoff delay incurred in the call to
     * ``onError`` if the error is retryable. Defaults to 1000 ms. Valid
     * parameter values are ``[0, INT_MAX]``. If the maximum retry delay is
     * less than the current retry delay of the transaction, then the current
     * retry delay will be clamped to the maximum retry delay. Prior to API
     * version 610, like all other transaction options, the maximum retry
     * delay must be reset after a call to ``onError``. If the API version is
     * 610 or greater, the retry limit is not reset after an ``onError``
     * call. Note that at all API versions, it is safe and legal to set the
     * maximum retry delay each time the transaction begins, so most code
     * written assuming the older behavior can be upgraded to the newer
     * behavior without requiring any modification, and the caller is not
     * required to implement special logic in retry loops to only
     * conditionally set this option.
     */
    TransactionOptionCode[TransactionOptionCode["MaxRetryDelay"] = 502] = "MaxRetryDelay";
    /**
     * Set the transaction size limit in bytes. The size is calculated by
     * combining the sizes of all keys and values written or mutated, all key
     * ranges cleared, and all read and write conflict ranges. (In other
     * words, it includes the total size of all data included in the request
     * to the cluster to commit the transaction.) Large transactions can
     * cause performance problems on FoundationDB clusters, so setting this
     * limit to a smaller value than the default can help prevent the client
     * from accidentally degrading the cluster's performance. This value must
     * be at least 32 and cannot be set to higher than 10,000,000, the
     * default transaction size limit.
     */
    TransactionOptionCode[TransactionOptionCode["SizeLimit"] = 503] = "SizeLimit";
    /**
     * Associate this transaction with this ID for the purpose of checking
     * whether or not this transaction has already committed. Must be at
     * least 16 bytes and less than 256 bytes. This feature is in development
     * and not ready for general use.
     */
    TransactionOptionCode[TransactionOptionCode["IdempotencyId"] = 504] = "IdempotencyId";
    /**
     * Automatically assign a random 16 byte idempotency id for this
     * transaction. Prevents commits from failing with
     * ``commit_unknown_result``. WARNING: If you are also using the
     * multiversion client or transaction timeouts, if either
     * cluster_version_changed or transaction_timed_out was thrown during a
     * commit, then that commit may have already succeeded or may succeed in
     * the future. This feature is in development and not ready for general
     * use.
     */
    TransactionOptionCode[TransactionOptionCode["AutomaticIdempotency"] = 505] = "AutomaticIdempotency";
    /**
     * Snapshot read operations will see the results of writes done in the
     * same transaction. This is the default behavior.
     */
    TransactionOptionCode[TransactionOptionCode["SnapshotRywEnable"] = 600] = "SnapshotRywEnable";
    /**
     * Snapshot read operations will not see the results of writes done in
     * the same transaction. This was the default behavior prior to API
     * version 300.
     */
    TransactionOptionCode[TransactionOptionCode["SnapshotRywDisable"] = 601] = "SnapshotRywDisable";
    /**
     * The transaction can read and write to locked databases, and is
     * responsible for checking that it took the lock.
     */
    TransactionOptionCode[TransactionOptionCode["LockAware"] = 700] = "LockAware";
    /**
     * By default, operations that are performed on a transaction while it is
     * being committed will not only fail themselves, but they will attempt
     * to fail other in-flight operations (such as the commit) as well. This
     * behavior is intended to help developers discover situations where
     * operations could be unintentionally executed after the transaction has
     * been reset. Setting this option removes that protection, causing only
     * the offending operation to fail.
     */
    TransactionOptionCode[TransactionOptionCode["UsedDuringCommitProtectionDisable"] = 701] = "UsedDuringCommitProtectionDisable";
    /**
     * The transaction can read from locked databases.
     */
    TransactionOptionCode[TransactionOptionCode["ReadLockAware"] = 702] = "ReadLockAware";
    /**
     * No other transactions will be applied before this transaction within
     * the same commit version.
     */
    TransactionOptionCode[TransactionOptionCode["FirstInBatch"] = 710] = "FirstInBatch";
    /**
     * This option should only be used by tools which change the database
     * configuration.
     */
    TransactionOptionCode[TransactionOptionCode["UseProvisionalProxies"] = 711] = "UseProvisionalProxies";
    /**
     * The transaction can retrieve keys that are conflicting with other
     * transactions.
     */
    TransactionOptionCode[TransactionOptionCode["ReportConflictingKeys"] = 712] = "ReportConflictingKeys";
    /**
     * By default, the special key space will only allow users to read from
     * exactly one module (a subspace in the special key space). Use this
     * option to allow reading from zero or more modules. Users who set this
     * option should be prepared for new modules, which may have different
     * behaviors than the modules they're currently reading. For example, a
     * new module might block or return an error.
     */
    TransactionOptionCode[TransactionOptionCode["SpecialKeySpaceRelaxed"] = 713] = "SpecialKeySpaceRelaxed";
    /**
     * By default, users are not allowed to write to special keys. Enable
     * this option will implicitly enable all options required to achieve the
     * configuration change.
     */
    TransactionOptionCode[TransactionOptionCode["SpecialKeySpaceEnableWrites"] = 714] = "SpecialKeySpaceEnableWrites";
    /**
     * Adds a tag to the transaction that can be used to apply manual
     * targeted throttling. At most 5 tags can be set on a transaction.
     */
    TransactionOptionCode[TransactionOptionCode["Tag"] = 800] = "Tag";
    /**
     * Adds a tag to the transaction that can be used to apply manual or
     * automatic targeted throttling. At most 5 tags can be set on a
     * transaction.
     */
    TransactionOptionCode[TransactionOptionCode["AutoThrottleTag"] = 801] = "AutoThrottleTag";
    /**
     * Adds a parent to the Span of this transaction. Used for transaction
     * tracing. A span can be identified with any 16 bytes
     */
    TransactionOptionCode[TransactionOptionCode["SpanParent"] = 900] = "SpanParent";
    /**
     * Asks storage servers for how many bytes a clear key range contains.
     * Otherwise uses the location cache to roughly estimate this.
     */
    TransactionOptionCode[TransactionOptionCode["ExpensiveClearCostEstimationEnable"] = 1000] = "ExpensiveClearCostEstimationEnable";
    /**
     * Allows ``get`` operations to read from sections of keyspace that have
     * become unreadable because of versionstamp operations. These reads will
     * view versionstamp operations as if they were set operations that did
     * not fill in the versionstamp.
     */
    TransactionOptionCode[TransactionOptionCode["BypassUnreadable"] = 1100] = "BypassUnreadable";
    /**
     * Allows this transaction to use cached GRV from the database context.
     * Defaults to off. Upon first usage, starts a background updater to
     * periodically update the cache to avoid stale read versions. The
     * disable_client_bypass option must also be set.
     */
    TransactionOptionCode[TransactionOptionCode["UseGrvCache"] = 1101] = "UseGrvCache";
    /**
     * Specifically instruct this transaction to NOT use cached GRV.
     * Primarily used for the read version cache's background updater to
     * avoid attempting to read a cached entry in specific situations.
     */
    TransactionOptionCode[TransactionOptionCode["SkipGrvCache"] = 1102] = "SkipGrvCache";
    /**
     * Attach given authorization token to the transaction such that
     * subsequent tenant-aware requests are authorized
     */
    TransactionOptionCode[TransactionOptionCode["AuthorizationToken"] = 2000] = "AuthorizationToken";
})(TransactionOptionCode || (exports.TransactionOptionCode = TransactionOptionCode = {}));
var StreamingMode;
(function (StreamingMode) {
    /**
     * Client intends to consume the entire range and would like it all
     * transferred as early as possible.
     */
    StreamingMode[StreamingMode["WantAll"] = -2] = "WantAll";
    /**
     * The default. The client doesn't know how much of the range it is
     * likely to used and wants different performance concerns to be
     * balanced. Only a small portion of data is transferred to the client
     * initially (in order to minimize costs if the client doesn't read the
     * entire range), and as the caller iterates over more items in the range
     * larger batches will be transferred in order to minimize latency. After
     * enough iterations, the iterator mode will eventually reach the same
     * byte limit as ``WANT_ALL``
     */
    StreamingMode[StreamingMode["Iterator"] = -1] = "Iterator";
    /**
     * Infrequently used. The client has passed a specific row limit and
     * wants that many rows delivered in a single batch. Because of iterator
     * operation in client drivers make request batches transparent to the
     * user, consider ``WANT_ALL`` StreamingMode instead. A row limit must be
     * specified if this mode is used.
     */
    StreamingMode[StreamingMode["Exact"] = 0] = "Exact";
    /**
     * Infrequently used. Transfer data in batches small enough to not be
     * much more expensive than reading individual rows, to minimize cost if
     * iteration stops early.
     */
    StreamingMode[StreamingMode["Small"] = 1] = "Small";
    /**
     * Infrequently used. Transfer data in batches sized in between small and
     * large.
     */
    StreamingMode[StreamingMode["Medium"] = 2] = "Medium";
    /**
     * Infrequently used. Transfer data in batches large enough to be, in a
     * high-concurrency environment, nearly as efficient as possible. If the
     * client stops iteration early, some disk and network bandwidth may be
     * wasted. The batch size may still be too small to allow a single client
     * to get high throughput from the database, so if that is what you need
     * consider the SERIAL StreamingMode.
     */
    StreamingMode[StreamingMode["Large"] = 3] = "Large";
    /**
     * Transfer data in batches large enough that an individual client can
     * get reasonable read bandwidth from the database. If the client stops
     * iteration early, considerable disk and network bandwidth may be
     * wasted.
     */
    StreamingMode[StreamingMode["Serial"] = 4] = "Serial";
})(StreamingMode || (exports.StreamingMode = StreamingMode = {}));
var MutationType;
(function (MutationType) {
    /**
     * Performs an addition of little-endian integers. If the existing value
     * in the database is not present or shorter than ``param``, it is first
     * extended to the length of ``param`` with zero bytes.  If ``param`` is
     * shorter than the existing value in the database, the existing value is
     * truncated to match the length of ``param``. The integers to be added
     * must be stored in a little-endian representation.  They can be signed
     * in two's complement representation or unsigned. You can add to an
     * integer at a known offset in the value by prepending the appropriate
     * number of zero bytes to ``param`` and padding with zero bytes to match
     * the length of the value. However, this offset technique requires that
     * you know the addition will not cause the integer field within the
     * value to overflow.
     */
    MutationType[MutationType["Add"] = 2] = "Add";
    // DEPRECATED
    MutationType[MutationType["And"] = 6] = "And";
    /**
     * Performs a bitwise ``and`` operation.  If the existing value in the
     * database is not present, then ``param`` is stored in the database. If
     * the existing value in the database is shorter than ``param``, it is
     * first extended to the length of ``param`` with zero bytes.  If
     * ``param`` is shorter than the existing value in the database, the
     * existing value is truncated to match the length of ``param``.
     */
    MutationType[MutationType["BitAnd"] = 6] = "BitAnd";
    // DEPRECATED
    MutationType[MutationType["Or"] = 7] = "Or";
    /**
     * Performs a bitwise ``or`` operation.  If the existing value in the
     * database is not present or shorter than ``param``, it is first
     * extended to the length of ``param`` with zero bytes.  If ``param`` is
     * shorter than the existing value in the database, the existing value is
     * truncated to match the length of ``param``.
     */
    MutationType[MutationType["BitOr"] = 7] = "BitOr";
    // DEPRECATED
    MutationType[MutationType["Xor"] = 8] = "Xor";
    /**
     * Performs a bitwise ``xor`` operation.  If the existing value in the
     * database is not present or shorter than ``param``, it is first
     * extended to the length of ``param`` with zero bytes.  If ``param`` is
     * shorter than the existing value in the database, the existing value is
     * truncated to match the length of ``param``.
     */
    MutationType[MutationType["BitXor"] = 8] = "BitXor";
    /**
     * Appends ``param`` to the end of the existing value already in the
     * database at the given key (or creates the key and sets the value to
     * ``param`` if the key is empty). This will only append the value if the
     * final concatenated value size is less than or equal to the maximum
     * value size (i.e., if it fits). WARNING: No error is surfaced back to
     * the user if the final value is too large because the mutation will not
     * be applied until after the transaction has been committed. Therefore,
     * it is only safe to use this mutation type if one can guarantee that
     * one will keep the total value size under the maximum size.
     */
    MutationType[MutationType["AppendIfFits"] = 9] = "AppendIfFits";
    /**
     * Performs a little-endian comparison of byte strings. If the existing
     * value in the database is not present or shorter than ``param``, it is
     * first extended to the length of ``param`` with zero bytes.  If
     * ``param`` is shorter than the existing value in the database, the
     * existing value is truncated to match the length of ``param``. The
     * larger of the two values is then stored in the database.
     */
    MutationType[MutationType["Max"] = 12] = "Max";
    /**
     * Performs a little-endian comparison of byte strings. If the existing
     * value in the database is not present, then ``param`` is stored in the
     * database. If the existing value in the database is shorter than
     * ``param``, it is first extended to the length of ``param`` with zero
     * bytes.  If ``param`` is shorter than the existing value in the
     * database, the existing value is truncated to match the length of
     * ``param``. The smaller of the two values is then stored in the
     * database.
     */
    MutationType[MutationType["Min"] = 13] = "Min";
    /**
     * Transforms ``key`` using a versionstamp for the transaction. Sets the
     * transformed key in the database to ``param``. The key is transformed
     * by removing the final four bytes from the key and reading those as a
     * little-Endian 32-bit integer to get a position ``pos``. The 10 bytes
     * of the key from ``pos`` to ``pos + 10`` are replaced with the
     * versionstamp of the transaction used. The first byte of the key is
     * position 0. A versionstamp is a 10 byte, unique, monotonically (but
     * not sequentially) increasing value for each committed transaction. The
     * first 8 bytes are the committed version of the database (serialized in
     * big-Endian order). The last 2 bytes are monotonic in the serialization
     * order for transactions. WARNING: At this time, versionstamps are
     * compatible with the Tuple layer only in the Java, Python, and Go
     * bindings. Also, note that prior to API version 520, the offset was
     * computed from only the final two bytes rather than the final four
     * bytes.
     */
    MutationType[MutationType["SetVersionstampedKey"] = 14] = "SetVersionstampedKey";
    /**
     * Transforms ``param`` using a versionstamp for the transaction. Sets
     * the ``key`` given to the transformed ``param``. The parameter is
     * transformed by removing the final four bytes from ``param`` and
     * reading those as a little-Endian 32-bit integer to get a position
     * ``pos``. The 10 bytes of the parameter from ``pos`` to ``pos + 10``
     * are replaced with the versionstamp of the transaction used. The first
     * byte of the parameter is position 0. A versionstamp is a 10 byte,
     * unique, monotonically (but not sequentially) increasing value for each
     * committed transaction. The first 8 bytes are the committed version of
     * the database (serialized in big-Endian order). The last 2 bytes are
     * monotonic in the serialization order for transactions. WARNING: At
     * this time, versionstamps are compatible with the Tuple layer only in
     * the Java, Python, and Go bindings. Also, note that prior to API
     * version 520, the versionstamp was always placed at the beginning of
     * the parameter rather than computing an offset.
     */
    MutationType[MutationType["SetVersionstampedValue"] = 15] = "SetVersionstampedValue";
    /**
     * Performs lexicographic comparison of byte strings. If the existing
     * value in the database is not present, then ``param`` is stored.
     * Otherwise the smaller of the two values is then stored in the
     * database.
     */
    MutationType[MutationType["ByteMin"] = 16] = "ByteMin";
    /**
     * Performs lexicographic comparison of byte strings. If the existing
     * value in the database is not present, then ``param`` is stored.
     * Otherwise the larger of the two values is then stored in the database.
     */
    MutationType[MutationType["ByteMax"] = 17] = "ByteMax";
    /**
     * Performs an atomic ``compare and clear`` operation. If the existing
     * value in the database is equal to the given value, then given key is
     * cleared.
     */
    MutationType[MutationType["CompareAndClear"] = 20] = "CompareAndClear";
})(MutationType || (exports.MutationType = MutationType = {}));
var ConflictRangeType;
(function (ConflictRangeType) {
    /**
     * Used to add a read conflict range
     */
    ConflictRangeType[ConflictRangeType["Read"] = 0] = "Read";
    /**
     * Used to add a write conflict range
     */
    ConflictRangeType[ConflictRangeType["Write"] = 1] = "Write";
})(ConflictRangeType || (exports.ConflictRangeType = ConflictRangeType = {}));
var ErrorPredicate;
(function (ErrorPredicate) {
    /**
     * Returns ``true`` if the error indicates the operations in the
     * transactions should be retried because of transient error.
     */
    ErrorPredicate[ErrorPredicate["Retryable"] = 50000] = "Retryable";
    /**
     * Returns ``true`` if the error indicates the transaction may have
     * succeeded, though not in a way the system can verify.
     */
    ErrorPredicate[ErrorPredicate["MaybeCommitted"] = 50001] = "MaybeCommitted";
    /**
     * Returns ``true`` if the error indicates the transaction has not
     * committed, though in a way that can be retried.
     */
    ErrorPredicate[ErrorPredicate["RetryableNotCommitted"] = 50002] = "RetryableNotCommitted";
})(ErrorPredicate || (exports.ErrorPredicate = ErrorPredicate = {}));
exports.networkOptionData = {
    local_address: {
        code: 10,
        description: "Deprecated",
        deprecated: true,
        type: 'string',
        paramDescription: "IP:PORT",
    },
    cluster_file: {
        code: 20,
        description: "Deprecated",
        deprecated: true,
        type: 'string',
        paramDescription: "path to cluster file",
    },
    trace_enable: {
        code: 30,
        description: "Enables trace output to a file in a directory of the clients choosing",
        type: 'string',
        paramDescription: "path to output directory (or NULL for current working directory)",
    },
    trace_roll_size: {
        code: 31,
        description: "Sets the maximum size in bytes of a single trace output file. This value should be in the range ``[0, INT64_MAX]``. If the value is set to 0, there is no limit on individual file size. The default is a maximum size of 10,485,760 bytes.",
        type: 'int',
        paramDescription: "max size of a single trace output file",
    },
    trace_max_logs_size: {
        code: 32,
        description: "Sets the maximum size of all the trace output files put together. This value should be in the range ``[0, INT64_MAX]``. If the value is set to 0, there is no limit on the total size of the files. The default is a maximum size of 104,857,600 bytes. If the default roll size is used, this means that a maximum of 10 trace files will be written at a time.",
        type: 'int',
        paramDescription: "max total size of trace files",
    },
    trace_log_group: {
        code: 33,
        description: "Sets the 'LogGroup' attribute with the specified value for all events in the trace output files. The default log group is 'default'.",
        type: 'string',
        paramDescription: "value of the LogGroup attribute",
    },
    trace_format: {
        code: 34,
        description: "Select the format of the log files. xml (the default) and json are supported.",
        type: 'string',
        paramDescription: "Format of trace files",
    },
    trace_clock_source: {
        code: 35,
        description: "Select clock source for trace files. now (the default) or realtime are supported.",
        type: 'string',
        paramDescription: "Trace clock source",
    },
    trace_file_identifier: {
        code: 36,
        description: "Once provided, this string will be used to replace the port/PID in the log file names.",
        type: 'string',
        paramDescription: "The identifier that will be part of all trace file names",
    },
    trace_share_among_client_threads: {
        code: 37,
        description: "Use the same base trace file name for all client threads as it did before version 7.2. The current default behavior is to use distinct trace file names for client threads by including their version and thread index.",
        type: 'none',
    },
    trace_partial_file_suffix: {
        code: 39,
        description: "Set file suffix for partially written log files.",
        type: 'string',
        paramDescription: "Append this suffix to partially written log files. When a log file is complete, it is renamed to remove the suffix. No separator is added between the file and the suffix. If you want to add a file extension, you should include the separator - e.g. '.tmp' instead of 'tmp' to add the 'tmp' extension.",
    },
    knob: {
        code: 40,
        description: "Set internal tuning or debugging knobs",
        type: 'string',
        paramDescription: "knob_name=knob_value",
    },
    TLS_plugin: {
        code: 41,
        description: "Deprecated",
        deprecated: true,
        type: 'string',
        paramDescription: "file path or linker-resolved name",
    },
    TLS_cert_bytes: {
        code: 42,
        description: "Set the certificate chain",
        type: 'bytes',
        paramDescription: "certificates",
    },
    TLS_cert_path: {
        code: 43,
        description: "Set the file from which to load the certificate chain",
        type: 'string',
        paramDescription: "file path",
    },
    TLS_key_bytes: {
        code: 45,
        description: "Set the private key corresponding to your own certificate",
        type: 'bytes',
        paramDescription: "key",
    },
    TLS_key_path: {
        code: 46,
        description: "Set the file from which to load the private key corresponding to your own certificate",
        type: 'string',
        paramDescription: "file path",
    },
    TLS_verify_peers: {
        code: 47,
        description: "Set the peer certificate field verification criteria",
        type: 'bytes',
        paramDescription: "verification pattern",
    },
    Buggify_enable: {
        code: 48,
        description: "",
        type: 'none',
    },
    Buggify_disable: {
        code: 49,
        description: "",
        type: 'none',
    },
    Buggify_section_activated_probability: {
        code: 50,
        description: "Set the probability of a BUGGIFY section being active for the current execution.  Only applies to code paths first traversed AFTER this option is changed.",
        type: 'int',
        paramDescription: "probability expressed as a percentage between 0 and 100",
    },
    Buggify_section_fired_probability: {
        code: 51,
        description: "Set the probability of an active BUGGIFY section being fired",
        type: 'int',
        paramDescription: "probability expressed as a percentage between 0 and 100",
    },
    TLS_ca_bytes: {
        code: 52,
        description: "Set the ca bundle",
        type: 'bytes',
        paramDescription: "ca bundle",
    },
    TLS_ca_path: {
        code: 53,
        description: "Set the file from which to load the certificate authority bundle",
        type: 'string',
        paramDescription: "file path",
    },
    TLS_password: {
        code: 54,
        description: "Set the passphrase for encrypted private key. Password should be set before setting the key for the password to be used.",
        type: 'string',
        paramDescription: "key passphrase",
    },
    disable_multi_version_client_api: {
        code: 60,
        description: "Disables the multi-version client API and instead uses the local client directly. Must be set before setting up the network.",
        type: 'none',
    },
    callbacks_on_external_threads: {
        code: 61,
        description: "If set, callbacks from external client libraries can be called from threads created by the FoundationDB client library. Otherwise, callbacks will be called from either the thread used to add the callback or the network thread. Setting this option can improve performance when connected using an external client, but may not be safe to use in all environments. Must be set before setting up the network. WARNING: This feature is considered experimental at this time.",
        type: 'none',
    },
    external_client_library: {
        code: 62,
        description: "Adds an external client library for use by the multi-version client API. Must be set before setting up the network.",
        type: 'string',
        paramDescription: "path to client library",
    },
    external_client_directory: {
        code: 63,
        description: "Searches the specified path for dynamic libraries and adds them to the list of client libraries for use by the multi-version client API. Must be set before setting up the network.",
        type: 'string',
        paramDescription: "path to directory containing client libraries",
    },
    disable_local_client: {
        code: 64,
        description: "Prevents connections through the local client, allowing only connections through externally loaded client libraries.",
        type: 'none',
    },
    client_threads_per_version: {
        code: 65,
        description: "Spawns multiple worker threads for each version of the client that is loaded.  Setting this to a number greater than one implies disable_local_client.",
        type: 'int',
        paramDescription: "Number of client threads to be spawned.  Each cluster will be serviced by a single client thread.",
    },
    future_version_client_library: {
        code: 66,
        description: "Adds an external client library to be used with a future version protocol. This option can be used testing purposes only!",
        type: 'string',
        paramDescription: "path to client library",
    },
    disable_client_statistics_logging: {
        code: 70,
        description: "Disables logging of client statistics, such as sampled transaction activity.",
        type: 'none',
    },
    enable_slow_task_profiling: {
        code: 71,
        description: "Deprecated",
        deprecated: true,
        type: 'none',
    },
    enable_run_loop_profiling: {
        code: 71,
        description: "Enables debugging feature to perform run loop profiling. Requires trace logging to be enabled. WARNING: this feature is not recommended for use in production.",
        type: 'none',
    },
    disable_client_bypass: {
        code: 72,
        description: "Prevents the multi-version client API from being disabled, even if no external clients are configured. This option is required to use GRV caching.",
        type: 'none',
    },
    client_buggify_enable: {
        code: 80,
        description: "Enable client buggify - will make requests randomly fail (intended for client testing)",
        type: 'none',
    },
    client_buggify_disable: {
        code: 81,
        description: "Disable client buggify",
        type: 'none',
    },
    client_buggify_section_activated_probability: {
        code: 82,
        description: "Set the probability of a CLIENT_BUGGIFY section being active for the current execution.",
        type: 'int',
        paramDescription: "probability expressed as a percentage between 0 and 100",
    },
    client_buggify_section_fired_probability: {
        code: 83,
        description: "Set the probability of an active CLIENT_BUGGIFY section being fired. A section will only fire if it was activated",
        type: 'int',
        paramDescription: "probability expressed as a percentage between 0 and 100",
    },
    distributed_client_tracer: {
        code: 90,
        description: "Set a tracer to run on the client. Should be set to the same value as the tracer set on the server.",
        type: 'string',
        paramDescription: "Distributed tracer type. Choose from none, log_file, or network_lossy",
    },
    client_tmp_dir: {
        code: 91,
        description: "Sets the directory for storing temporary files created by FDB client, such as temporary copies of client libraries. Defaults to /tmp",
        type: 'string',
        paramDescription: "Client directory for temporary files. ",
    },
    supported_client_versions: {
        code: 1000,
        description: "This option is set automatically to communicate the list of supported clients to the active client.",
        type: 'string',
        paramDescription: "[release version],[source version],[protocol version];...",
    },
    external_client: {
        code: 1001,
        description: "This option is set automatically on all clients loaded externally using the multi-version API.",
        type: 'none',
    },
    external_client_transport_id: {
        code: 1002,
        description: "This option tells a child on a multiversion client what transport ID to use.",
        type: 'int',
        paramDescription: "Transport ID for the child connection",
    },
};
exports.databaseOptionData = {
    location_cache_size: {
        code: 10,
        description: "Set the size of the client location cache. Raising this value can boost performance in very large databases where clients access data in a near-random pattern. Defaults to 100000.",
        type: 'int',
        paramDescription: "Max location cache entries",
    },
    max_watches: {
        code: 20,
        description: "Set the maximum number of watches allowed to be outstanding on a database connection. Increasing this number could result in increased resource usage. Reducing this number will not cancel any outstanding watches. Defaults to 10000 and cannot be larger than 1000000.",
        type: 'int',
        paramDescription: "Max outstanding watches",
    },
    machine_id: {
        code: 21,
        description: "Specify the machine ID that was passed to fdbserver processes running on the same machine as this client, for better location-aware load balancing.",
        type: 'string',
        paramDescription: "Hexadecimal ID",
    },
    datacenter_id: {
        code: 22,
        description: "Specify the datacenter ID that was passed to fdbserver processes running in the same datacenter as this client, for better location-aware load balancing.",
        type: 'string',
        paramDescription: "Hexadecimal ID",
    },
    snapshot_ryw_enable: {
        code: 26,
        description: "Snapshot read operations will see the results of writes done in the same transaction. This is the default behavior.",
        type: 'none',
    },
    snapshot_ryw_disable: {
        code: 27,
        description: "Snapshot read operations will not see the results of writes done in the same transaction. This was the default behavior prior to API version 300.",
        type: 'none',
    },
    transaction_logging_max_field_length: {
        code: 405,
        description: "Sets the maximum escaped length of key and value fields to be logged to the trace file via the LOG_TRANSACTION option. This sets the ``transaction_logging_max_field_length`` option of each transaction created by this database. See the transaction option description for more information.",
        type: 'int',
        paramDescription: "Maximum length of escaped key and value fields.",
    },
    transaction_timeout: {
        code: 500,
        description: "Set a timeout in milliseconds which, when elapsed, will cause each transaction automatically to be cancelled. This sets the ``timeout`` option of each transaction created by this database. See the transaction option description for more information. Using this option requires that the API version is 610 or higher.",
        type: 'int',
        paramDescription: "value in milliseconds of timeout",
    },
    transaction_retry_limit: {
        code: 501,
        description: "Set a maximum number of retries after which additional calls to ``onError`` will throw the most recently seen error code. This sets the ``retry_limit`` option of each transaction created by this database. See the transaction option description for more information.",
        type: 'int',
        paramDescription: "number of times to retry",
    },
    transaction_max_retry_delay: {
        code: 502,
        description: "Set the maximum amount of backoff delay incurred in the call to ``onError`` if the error is retryable. This sets the ``max_retry_delay`` option of each transaction created by this database. See the transaction option description for more information.",
        type: 'int',
        paramDescription: "value in milliseconds of maximum delay",
    },
    transaction_size_limit: {
        code: 503,
        description: "Set the maximum transaction size in bytes. This sets the ``size_limit`` option on each transaction created by this database. See the transaction option description for more information.",
        type: 'int',
        paramDescription: "value in bytes",
    },
    transaction_causal_read_risky: {
        code: 504,
        description: "The read version will be committed, and usually will be the latest committed, but might not be the latest committed in the event of a simultaneous fault and misbehaving clock.",
        type: 'none',
    },
    transaction_include_port_in_address: {
        code: 505,
        description: "Deprecated. Addresses returned by get_addresses_for_key include the port when enabled. As of api version 630, this option is enabled by default and setting this has no effect.",
        type: 'none',
    },
    transaction_automatic_idempotency: {
        code: 506,
        description: "Set a random idempotency id for all transactions. See the transaction option description for more information. This feature is in development and not ready for general use.",
        type: 'none',
    },
    transaction_bypass_unreadable: {
        code: 700,
        description: "Allows ``get`` operations to read from sections of keyspace that have become unreadable because of versionstamp operations. This sets the ``bypass_unreadable`` option of each transaction created by this database. See the transaction option description for more information.",
        type: 'none',
    },
    use_config_database: {
        code: 800,
        description: "Use configuration database.",
        type: 'none',
    },
    test_causal_read_risky: {
        code: 900,
        description: "An integer between 0 and 100 (default is 0) expressing the probability that a client will verify it can't read stale data whenever it detects a recovery.",
        type: 'none',
    },
};
exports.transactionOptionData = {
    causal_write_risky: {
        code: 10,
        description: "The transaction, if not self-conflicting, may be committed a second time after commit succeeds, in the event of a fault",
        type: 'none',
    },
    causal_read_risky: {
        code: 20,
        description: "The read version will be committed, and usually will be the latest committed, but might not be the latest committed in the event of a simultaneous fault and misbehaving clock.",
        type: 'none',
    },
    causal_read_disable: {
        code: 21,
        description: "undefined",
        type: 'none',
    },
    include_port_in_address: {
        code: 23,
        description: "Addresses returned by get_addresses_for_key include the port when enabled. As of api version 630, this option is enabled by default and setting this has no effect.",
        type: 'none',
    },
    next_write_no_write_conflict_range: {
        code: 30,
        description: "The next write performed on this transaction will not generate a write conflict range. As a result, other transactions which read the key(s) being modified by the next write will not conflict with this transaction. Care needs to be taken when using this option on a transaction that is shared between multiple threads. When setting this option, write conflict ranges will be disabled on the next write operation, regardless of what thread it is on.",
        type: 'none',
    },
    commit_on_first_proxy: {
        code: 40,
        description: "Committing this transaction will bypass the normal load balancing across commit proxies and go directly to the specifically nominated 'first commit proxy'.",
        type: 'none',
    },
    check_writes_enable: {
        code: 50,
        description: "undefined",
        type: 'none',
    },
    read_your_writes_disable: {
        code: 51,
        description: "Reads performed by a transaction will not see any prior mutations that occured in that transaction, instead seeing the value which was in the database at the transaction's read version. This option may provide a small performance benefit for the client, but also disables a number of client-side optimizations which are beneficial for transactions which tend to read and write the same keys within a single transaction. It is an error to set this option after performing any reads or writes on the transaction.",
        type: 'none',
    },
    read_ahead_disable: {
        code: 52,
        description: "Deprecated",
        deprecated: true,
        type: 'none',
    },
    durability_datacenter: {
        code: 110,
        description: "undefined",
        type: 'none',
    },
    durability_risky: {
        code: 120,
        description: "undefined",
        type: 'none',
    },
    durability_dev_null_is_web_scale: {
        code: 130,
        description: "Deprecated",
        deprecated: true,
        type: 'none',
    },
    priority_system_immediate: {
        code: 200,
        description: "Specifies that this transaction should be treated as highest priority and that lower priority transactions should block behind this one. Use is discouraged outside of low-level tools",
        type: 'none',
    },
    priority_batch: {
        code: 201,
        description: "Specifies that this transaction should be treated as low priority and that default priority transactions will be processed first. Batch priority transactions will also be throttled at load levels smaller than for other types of transactions and may be fully cut off in the event of machine failures. Useful for doing batch work simultaneously with latency-sensitive work",
        type: 'none',
    },
    initialize_new_database: {
        code: 300,
        description: "This is a write-only transaction which sets the initial configuration. This option is designed for use by database system tools only.",
        type: 'none',
    },
    access_system_keys: {
        code: 301,
        description: "Allows this transaction to read and modify system keys (those that start with the byte 0xFF). Implies raw_access.",
        type: 'none',
    },
    read_system_keys: {
        code: 302,
        description: "Allows this transaction to read system keys (those that start with the byte 0xFF). Implies raw_access.",
        type: 'none',
    },
    raw_access: {
        code: 303,
        description: "Allows this transaction to access the raw key-space when tenant mode is on.",
        type: 'none',
    },
    debug_dump: {
        code: 400,
        description: "undefined",
        type: 'none',
    },
    debug_retry_logging: {
        code: 401,
        description: "undefined",
        type: 'string',
        paramDescription: "Optional transaction name",
    },
    transaction_logging_enable: {
        code: 402,
        description: "Deprecated",
        deprecated: true,
        type: 'string',
        paramDescription: "String identifier to be used in the logs when tracing this transaction. The identifier must not exceed 100 characters.",
    },
    debug_transaction_identifier: {
        code: 403,
        description: "Sets a client provided identifier for the transaction that will be used in scenarios like tracing or profiling. Client trace logging or transaction profiling must be separately enabled.",
        type: 'string',
        paramDescription: "String identifier to be used when tracing or profiling this transaction. The identifier must not exceed 100 characters.",
    },
    log_transaction: {
        code: 404,
        description: "Enables tracing for this transaction and logs results to the client trace logs. The DEBUG_TRANSACTION_IDENTIFIER option must be set before using this option, and client trace logging must be enabled to get log output.",
        type: 'none',
    },
    transaction_logging_max_field_length: {
        code: 405,
        description: "Sets the maximum escaped length of key and value fields to be logged to the trace file via the LOG_TRANSACTION option, after which the field will be truncated. A negative value disables truncation.",
        type: 'int',
        paramDescription: "Maximum length of escaped key and value fields.",
    },
    server_request_tracing: {
        code: 406,
        description: "Sets an identifier for server tracing of this transaction. When committed, this identifier triggers logging when each part of the transaction authority encounters it, which is helpful in diagnosing slowness in misbehaving clusters. The identifier is randomly generated. When there is also a debug_transaction_identifier, both IDs are logged together.",
        type: 'none',
    },
    timeout: {
        code: 500,
        description: "Set a timeout in milliseconds which, when elapsed, will cause the transaction automatically to be cancelled. Valid parameter values are ``[0, INT_MAX]``. If set to 0, will disable all timeouts. All pending and any future uses of the transaction will throw an exception. The transaction can be used again after it is reset. Prior to API version 610, like all other transaction options, the timeout must be reset after a call to ``onError``. If the API version is 610 or greater, the timeout is not reset after an ``onError`` call. This allows the user to specify a longer timeout on specific transactions than the default timeout specified through the ``transaction_timeout`` database option without the shorter database timeout cancelling transactions that encounter a retryable error. Note that at all API versions, it is safe and legal to set the timeout each time the transaction begins, so most code written assuming the older behavior can be upgraded to the newer behavior without requiring any modification, and the caller is not required to implement special logic in retry loops to only conditionally set this option.",
        type: 'int',
        paramDescription: "value in milliseconds of timeout",
    },
    retry_limit: {
        code: 501,
        description: "Set a maximum number of retries after which additional calls to ``onError`` will throw the most recently seen error code. Valid parameter values are ``[-1, INT_MAX]``. If set to -1, will disable the retry limit. Prior to API version 610, like all other transaction options, the retry limit must be reset after a call to ``onError``. If the API version is 610 or greater, the retry limit is not reset after an ``onError`` call. Note that at all API versions, it is safe and legal to set the retry limit each time the transaction begins, so most code written assuming the older behavior can be upgraded to the newer behavior without requiring any modification, and the caller is not required to implement special logic in retry loops to only conditionally set this option.",
        type: 'int',
        paramDescription: "number of times to retry",
    },
    max_retry_delay: {
        code: 502,
        description: "Set the maximum amount of backoff delay incurred in the call to ``onError`` if the error is retryable. Defaults to 1000 ms. Valid parameter values are ``[0, INT_MAX]``. If the maximum retry delay is less than the current retry delay of the transaction, then the current retry delay will be clamped to the maximum retry delay. Prior to API version 610, like all other transaction options, the maximum retry delay must be reset after a call to ``onError``. If the API version is 610 or greater, the retry limit is not reset after an ``onError`` call. Note that at all API versions, it is safe and legal to set the maximum retry delay each time the transaction begins, so most code written assuming the older behavior can be upgraded to the newer behavior without requiring any modification, and the caller is not required to implement special logic in retry loops to only conditionally set this option.",
        type: 'int',
        paramDescription: "value in milliseconds of maximum delay",
    },
    size_limit: {
        code: 503,
        description: "Set the transaction size limit in bytes. The size is calculated by combining the sizes of all keys and values written or mutated, all key ranges cleared, and all read and write conflict ranges. (In other words, it includes the total size of all data included in the request to the cluster to commit the transaction.) Large transactions can cause performance problems on FoundationDB clusters, so setting this limit to a smaller value than the default can help prevent the client from accidentally degrading the cluster's performance. This value must be at least 32 and cannot be set to higher than 10,000,000, the default transaction size limit.",
        type: 'int',
        paramDescription: "value in bytes",
    },
    idempotency_id: {
        code: 504,
        description: "Associate this transaction with this ID for the purpose of checking whether or not this transaction has already committed. Must be at least 16 bytes and less than 256 bytes. This feature is in development and not ready for general use.",
        type: 'string',
        paramDescription: "Unique ID",
    },
    automatic_idempotency: {
        code: 505,
        description: "Automatically assign a random 16 byte idempotency id for this transaction. Prevents commits from failing with ``commit_unknown_result``. WARNING: If you are also using the multiversion client or transaction timeouts, if either cluster_version_changed or transaction_timed_out was thrown during a commit, then that commit may have already succeeded or may succeed in the future. This feature is in development and not ready for general use.",
        type: 'none',
    },
    snapshot_ryw_enable: {
        code: 600,
        description: "Snapshot read operations will see the results of writes done in the same transaction. This is the default behavior.",
        type: 'none',
    },
    snapshot_ryw_disable: {
        code: 601,
        description: "Snapshot read operations will not see the results of writes done in the same transaction. This was the default behavior prior to API version 300.",
        type: 'none',
    },
    lock_aware: {
        code: 700,
        description: "The transaction can read and write to locked databases, and is responsible for checking that it took the lock.",
        type: 'none',
    },
    used_during_commit_protection_disable: {
        code: 701,
        description: "By default, operations that are performed on a transaction while it is being committed will not only fail themselves, but they will attempt to fail other in-flight operations (such as the commit) as well. This behavior is intended to help developers discover situations where operations could be unintentionally executed after the transaction has been reset. Setting this option removes that protection, causing only the offending operation to fail.",
        type: 'none',
    },
    read_lock_aware: {
        code: 702,
        description: "The transaction can read from locked databases.",
        type: 'none',
    },
    first_in_batch: {
        code: 710,
        description: "No other transactions will be applied before this transaction within the same commit version.",
        type: 'none',
    },
    use_provisional_proxies: {
        code: 711,
        description: "This option should only be used by tools which change the database configuration.",
        type: 'none',
    },
    report_conflicting_keys: {
        code: 712,
        description: "The transaction can retrieve keys that are conflicting with other transactions.",
        type: 'none',
    },
    special_key_space_relaxed: {
        code: 713,
        description: "By default, the special key space will only allow users to read from exactly one module (a subspace in the special key space). Use this option to allow reading from zero or more modules. Users who set this option should be prepared for new modules, which may have different behaviors than the modules they're currently reading. For example, a new module might block or return an error.",
        type: 'none',
    },
    special_key_space_enable_writes: {
        code: 714,
        description: "By default, users are not allowed to write to special keys. Enable this option will implicitly enable all options required to achieve the configuration change.",
        type: 'none',
    },
    tag: {
        code: 800,
        description: "Adds a tag to the transaction that can be used to apply manual targeted throttling. At most 5 tags can be set on a transaction.",
        type: 'string',
        paramDescription: "String identifier used to associated this transaction with a throttling group. Must not exceed 16 characters.",
    },
    auto_throttle_tag: {
        code: 801,
        description: "Adds a tag to the transaction that can be used to apply manual or automatic targeted throttling. At most 5 tags can be set on a transaction.",
        type: 'string',
        paramDescription: "String identifier used to associated this transaction with a throttling group. Must not exceed 16 characters.",
    },
    span_parent: {
        code: 900,
        description: "Adds a parent to the Span of this transaction. Used for transaction tracing. A span can be identified with any 16 bytes",
        type: 'bytes',
        paramDescription: "A byte string of length 16 used to associate the span of this transaction with a parent",
    },
    expensive_clear_cost_estimation_enable: {
        code: 1000,
        description: "Asks storage servers for how many bytes a clear key range contains. Otherwise uses the location cache to roughly estimate this.",
        type: 'none',
    },
    bypass_unreadable: {
        code: 1100,
        description: "Allows ``get`` operations to read from sections of keyspace that have become unreadable because of versionstamp operations. These reads will view versionstamp operations as if they were set operations that did not fill in the versionstamp.",
        type: 'none',
    },
    use_grv_cache: {
        code: 1101,
        description: "Allows this transaction to use cached GRV from the database context. Defaults to off. Upon first usage, starts a background updater to periodically update the cache to avoid stale read versions. The disable_client_bypass option must also be set.",
        type: 'none',
    },
    skip_grv_cache: {
        code: 1102,
        description: "Specifically instruct this transaction to NOT use cached GRV. Primarily used for the read version cache's background updater to avoid attempting to read a cached entry in specific situations.",
        type: 'none',
    },
    authorization_token: {
        code: 2000,
        description: "Attach given authorization token to the transaction such that subsequent tenant-aware requests are authorized",
        type: 'string',
        paramDescription: "A JSON Web Token authorized to access data belonging to one or more tenants, indicated by 'tenants' claim of the token's payload.",
    },
};
//# sourceMappingURL=opts.g.js.map