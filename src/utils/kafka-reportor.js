"use strict";

const {
    EventEmitter
} = require("events");
const {
    createLogger
} = require("winston");
const KafkaStreamTransport = require("winston-kafka-stream");

const slots = require("./slots");

/**
 * a KafkaClient reportor that report log message to KafkaServer
 * 
 * @class
 */
class KafkaReportor extends EventEmitter {

    /**
     * create a KafkaReportor instance that report message to special KafkaServer
     * 
     * @constructor
     * 
     * @param {object=} options - options to create a winston logger instance with kafkaClient Transport
     * @param {string=} options.level - log level(default:"info")
     * @param {string=} options.kafkaHost - special kafkaHost with format(host:port)(default:www.entanmo-kafka.com)
     * @param {string=} options.topic - kafka message topic(defaut:"entanmo-performance") 
     * 
     * @fires KafkaReportor#logged
     */
    constructor(options) {
        super();

        this._magic = undefined;
        // save options
        options = options || {};
        this._options = options;

        // create KafkasStreamTransport
        this._kafkaStream = new KafkaStreamTransport({
            level: options.level || "info",
            kafkaHost: options.host || "114.115.202.62:9092",
            producer: {
                topic: options.topic || "entanmo-performance"
            }
        });

        // create logger instance
        this._logger = createLogger({
            level: options.level || "info",
            transports: [
                this._kafkaStream
            ]
        });

        // listen logged event on kafkaStreamTransport
        this._kafkaStream.on("logged", this._onLoggedEvent.bind(this));

        // listen nodejs runtime exceptions include (error, uncaughtException, unhandledRejection)
        this._onSystemEvents();
    }

    /**
     * Report a message to the special KafkaServer
     * 
     * @function
     * @public
     * 
     * @param {any} message - The message to report to KafkaServer
     */
    report(action, message) {
        if (!this.validable) {
            return;
        }
        this._logger.log({
            level: this._options.level || "info",
            message: JSON.stringify({
                action: action,
                source: this.source,
                timestamp: this.timestamp,
                time: slots.getTime(),
                slotNumber: slots.getSlotNumber(),
                magic: this.magic,
                message: message
            })
        });
    }

    /**
     * Check if reportKafka is enabled
     * 
     * @function
     * @private
     * 
     * @returns {boolean} True: reportKafka enabled; False: reportKafka disabled
     */
    get validable() {
        if (global.reportKafka) {
            return true;
        }
        return false
    }

    /**
     * Get publicIp:port as source
     * 
     * @property
     * @public
     * 
     * @returns {string} The format source[host:port]
     */
    get source() {
        const publicIp = library.config.publicIp ? library.config.publicIp : "unknown";
        const port = library.config.port;
        return `${publicIp}:${port}`;
    }

    /**
     * Get current system datetime
     * 
     * @property
     * @public
     * 
     * @returns {string} The current datetime
     */
    get timestamp() {
        return (new Date()).toLocaleString();
    }

    /**
     * Get the number of milliseconds the current process has been running
     * 
     * @property
     * @public
     * 
     * @returns {number} The number of milliseconds
     */
    get uptime() {
        return Number.parseInt(process.uptime() * 1000);
    }

    /**
     * Get magic number of the system
     * 
     * @property
     * @public
     * 
     * @returns {string} The number of magic
     */
    get magic() {
        if (this._magic) {
            return this._magic;
        }

        if (global.library && global.library.config && global.library.config.magic) {
            this._magic = global.library.config.magic;
        }

        this._magic = this._magic || "unknown_magic";
        return this._magic;
    }

    /**
     * callback bind to KafkaStreamTrasnport`s logged event
     * 
     * @function
     * @private
     * 
     * @param {object} payload - The message object that reported to the special KafkaServer
     */
    _onLoggedEvent(payload) {
        this.emit("logged", payload);
    }

    /**
     * Report nodejs system exception events includes 'error', 'uncaughtException', 'unhandledRejection'
     * 
     */
    _onSystemEvents() {
        process.on("error", err => {
            this.report("nodejs", {
                subaction: "error",
                data: {
                    message: err.message,
                    stack: err.stack
                }
            });
        });

        process.on("uncaughtException", err => {
            this.report("nodejs", {
                subaction: "uncaughtException",
                data: {
                    message: err.message,
                    stack: err.stack
                }
            });
        });

        process.on("unhandledRejection", (reason, p) => {
            void (p);
            if (reason instanceof Error) {
                this.report("nodejs", {
                    subaction: "unhandledRejection",
                    data: {
                        message: reason.message,
                        stack: reason.stack
                    }
                });
            } else {
                this.report("nodejs", {
                    subaction: "unhandledRejection",
                    data: {
                        message: reason == null ? "unknown unhandledRejection" : reason.toString()
                    }
                });
            }
        });
    }
}

/**
 * Default kafkaReportor instance
 * 
 * @type {KafkaReportor}
 */
const defaultKafkaReportor = new KafkaReportor();

/**
 * Function to create a custom KafkaReportor instance
 * 
 * @function newReportor
 * 
 * @param {object=} options - options to create a winston logger instance with kafkaClient Transport
 * @param {string=} options.level - log level(default:"info")
 * @param {string=} options.kafkaHost - special kafkaHost with format(addr:port)(default:www.entanmo-kafka.com)
 * @param {string=} options.topic - kafka message topic(defaut:"entanmo-topic") 
 * @return {KafkaReportor} A KafkaReportor instance with special options
 * 
 * @see KafkaReportor
 */
defaultKafkaReportor.newReporter = function (options) {
    return new KafkaReportor(options);
}

module.exports = defaultKafkaReportor;