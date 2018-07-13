'use strict';

const Handler = require('./handler');
const powAddon = require('node-pow-addon');

class GPUHandler extends Handler {
    constructor() {
        super();

        this._state = Handler.PowState.PENDING;
        this._blockLoop = 100000;
    }

    setup() {
        return powAddon.setup(1);
    }

    pow(src, target, cb) {
        const timer = process.hrtime();
        if (this._state === Handler.PowState.RUNNING) {
            return setImmediate(() => {
                cb("Error: Pow is running");
            });
        }

        this._state = Handler.PowState.RUNNING;

        powAddon.mint(src, target, (result) => {
            const duration = process.hrtime(timer);
            console.log((new Date()).getTime(), "--------------- mint duration: ", (duration[0] + duration[1] / 1000000000.0), "sec", result);
            this._state = Handler.PowState.PENDING;
            if (!result.done) {
                cb(new Error("Mint failure."));
                return;
            }

            cb(null, {
                hash: result.value.target,
                nonce: result.value.nonce,
            });
        });
    }

    getState() {
        return this._state;
    }

    pending(cb) {
        if (this._state === Handler.PowState.PENDING) {
            return setImmediate(() => {
                cb(null, Handler.PowState.PENDING);
            });
        }

        powAddon.pending(() => {
            this._state = Handler.PowState.pending;
            setImmediate(() => {
                cb(null, Handler.PowState.RUNNING);
            });
        });
    }
}

module.exports = GPUHandler;