"use strict";

const Sntp = require("sntp");

// internal singleton
let internals = {};

// internal offset singleton variables
internals.last = {
    offset: 0,
    expires: 0,
    host: "",
    port: 0
};

/**
 * 同步时间，获取当前系统时间相对于NTP服务在的偏移值
 * 
 * @param {object} options - The options to get offset of local time
 * @param {string} options.host - The NTP server host
 * @param {number} options.port - The NTP server port
 * @param {number} options.clockSyncRefresh - The clock sync refresh duration
 * @param {number} options.timeout - The timeout for request
 * @param {boolean} options.resolveReference - The flag of resolve reference
 * 
 * @returns {number} The offset of local time
 */
async function offset(options = {}) {

    const now = Date.now();
    const clockSyncRefresh = options.clockSyncRefresh || 24 * 60 * 60 * 1000; // Daily

    if (internals.last.offset &&
        internals.last.host === options.host &&
        internals.last.port === options.port &&
        now < internals.last.expires) {

        return internals.last.offset;
    }

    const time = await Sntp.time(options);

    internals.last = {
        offset: Math.round(time.t),
        expires: now + clockSyncRefresh,
        host: options.host,
        port: options.port
    };

    return internals.last.offset;
}

// internal now singleton variables
internals.now = {
    started: false,
    syncing: false,
    intervalId: null
};

/**
 * 开启定时同步NTP时间
 * 
 * @param {object} options - The options to start sync ntp time
 * @param {string} options.host - The NTP server host
 * @param {number} options.port - The NTP server port
 * @param {number} options.clockSyncRefresh - The clock sync refresh duration
 * @param {number} options.timeout - The timeout for request
 * @param {boolean} options.resolveReference - The flag of resolve reference
 * @param {function} options.onError - The callback invoked on error
 */
async function start(options = {}) {

    if (internals.now.started) {
        return;
    }

    const tick = async () => {
        if (internals.syncing) {
            return;
        }

        try {
            internals.syncing = true;
            await offset(options);
        } catch (err) {
            if (options.onError) {
                options.onError(err);
            }
        } finally {
            internals.now.syncing = false;
        }
    };

    internals.now.started = true;
    internals.now.intervalId = setInterval(tick, options.clockSyncRefresh || 24 * 60 * 60 * 1000); // Daily
    await offset(options);
}

/**
 * 停止定时同步NTP时间
 */
function stop() {

    if (!internals.now.started) {
        return;
    }

    clearInterval(internals.now.intervalId);
    internals.now.started = false;
    internals.now.intervalId = null;
}

/**
 * 是否开启了定时同步NTP时间
 * 
 * @returns {boolean} - true: 开启; false: 未开启
 */
function isLive() {

    return internals.now.started;
}

/**
 * 获取当前同步的时间
 * 
 * @returns {number} 同步后的时间值
 */
function now() {

    const now = Date.now();
    if (!isLive() ||
        now >= internals.last.expires) {
        if (!internals.syncing) {
            return now;
        }
    }

    return now + internals.last.offset;
}

/**
 * 可用的NTP服务列表
 */
const remoteNtps = [
    {
        host: "us.ntp.org.cn",
        port: 123
    },
    {
        host: "cn.ntp.org.cn",
        port: 123
    },
    {
        host: "edu.ntp.org.cn",
        port: 123
    },
    {
        host: "tw.ntp.org.cn",
        port: 123
    },
    {
        host: "hk.ntp.org.cn",
        port: 123
    },
    {
        host: "sgp.ntp.org.cn",
        port: 123
    },
    {
        host: "kr.ntp.org.cn",
        port: 123
    },
    {
        host: "jp.ntp.org.cn",
        port: 123
    },
    {
        host: "de.ntp.org.cn",
        port: 123
    },
    {
        host: "ina.ntp.org.cn",
        port: 123
    }
];
// 内部使用的索引值
let currentIndex = 0;

/**
 * 循环获取NTP服务配置信息
 * @param {object} options - The options
 * @param {boolean} options.resolveReference - The resolve reference flag
 * @param {number} options.timeout - Timeout of the sync operation
 * @param {number} options.clockSyncRefresh - Interval of two sync operation 
 * @param {function} options.onError - callback for error
 * 
 * @returns {object} The NTP operation options
 */
function getNextOptions(options) {
    const index = currentIndex++ % remoteNtps.length;
    return {
        host: remoteNtps[index].host,
        port: remoteNtps[index].port,
        resolveReference: options.resolveReference,
        timeout: options.timeout,
        clockSyncRefresh: options.clockSyncRefresh,
        onError: options.onError
    };
}

/**
 * @class
 * 
 * NTP时间同步
 */
class SyncTime {

    /**
     * @constructor
     * 
     * @param {object} options - The options for SNTP 
     * @param {boolean} options.resolveReference - The flag of resolve reference
     * @param {number} options.timeout - Timeout of NTP operation
     * @param {number} options.clockSyncRefresh - Interval between two NTP operation
     * @param {function} cb - callback for error
     */
    constructor(options, cb) {
        options = options || {};

        this.defaultOpts = {};
        this.defaultOpts.resolveReference = options.resolveReference || false;
        this.defaultOpts.timeout = options.timeout || 1000;
        this.defaultOpts.clockSyncRefresh = options.clockSyncRefresh || 24 * 60 * 60 * 1000;
        this.defaultOpts.onError = this._onError.bind(this);

        this.lastOptions = getNextOptions(this.defaultOpts);

        const self = this;

        const loopStart = function () {
            setImmediate(function nextSntpStart() {
                self.lastOptions = getNextOptions(self.defaultOpts);
                internals.now.syncing = true;
                offset(self.lastOptions)
                    .then(result => {
                        void(result);
                        internals.now.syncing = false;
                    })
                    .catch(err => {
                        void(err);
                        setTimeout(nextSntpStart, 500);
                    });
            });
        };

        internals.now.syncing = true;
        start(this.lastOptions)
            .then(result => {
                void(result);
                internals.now.syncing = false;
                cb(null, self);
            })
            .catch(err => {
                void(err);
                cb(null, self);
                loopStart();
            });

        process.on("exit", code => {
            void(code);
            stop();
        });

        process.on("SIGINT", signal => {
            void (signal);
            stop();
        });
        process.on("SIGTERM", signal => {
            void (signal);
            stop();
        });

        process.on("uncaughtException", err => {
            void (err);
            stop();
        });
        process.on("unhandledRejection", err => {
            void (err);
            stop();
        });
    }

    /**
     * 获取当前同步时间
     * 
     * @returns {number} current sync ntp time
     */
    now() {
        return now();
    }

    /**
     * @private
     * 
     * @param {error} err - when NTP operation errors
     */
    _onError(err) {
        void(err);
        console.log(`[_onError] ${err.toString()}`);
        const self = this;
        offset(this.lastOptions)
            .then(result => {
                void(result);
            })
            .catch(err => {
                void(err);
                self._syncOffset(self.lastOptions);
            });
    }

    /**
     * @private
     * 
     * @param {object} options - The options
     * @param {boolean} options.resolveReference - The resolve reference flag
     * @param {number} options.timeout - Timeout of the sync operation
     * @param {number} options.clockSyncRefresh - Interval of two sync operation 
     * @param {function} options.onError - callback for error
     */
    _syncOffset(options) {
        function nextSntpStart() {
            internals.now.syncing = true;
            offset(options)
                .then(result => {
                    void(result);
                    internals.now.syncing = false;
                })
                .catch(err => {
                    void(err);
                    setTimeout(nextSntpStart, 500);
                });
        }
        nextSntpStart();
    }
}

module.exports = SyncTime;