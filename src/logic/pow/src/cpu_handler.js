'use strict';

const crypto = require('crypto');
const { PowState } = require('./constants');

class CPUHandler {
    constructor() {
        this._state = PowState.PENDING;
        this._blockLoop = 100000;
    }

    pow(src, target, cb) {
        if (this._state === PowState.RUNNING) {
            return setImmediate(() => {
                cb('Error: PoW is running.');
            });
        }
        this._state = PowState.RUNNING;
        let nonce = 0;
        const self = this;

       (function _pow() {
            if (self._state === PowState.PENDING) {
                return ;
            }
            for (let i = 0; i < self._blockLoop; i++) {
                const hasher = crypto.createHash('sha256').update(src + nonce.toString());
                const hashResult = hasher.digest('hex');
                if (hashResult.indexOf(target) === 0) {
                    self._state = PowState.PENDING;
                    return cb(null, {
                        hash: hashResult,
                        nonce: nonce
                    });
                }
                nonce += 1;
            }

            setImmediate(_pow);
        })();
    }

    getState() {
        return this._state;
    }

    pending(cb) {
        if (this._state === PowState.PENDING) {
            return setImmediate(() => {
                cb(null, PowState.PENDING);
            });
        }

        this._state = PowState.PENDING;
        setImmediate(() => {
            cb(null, PowState.RUNNING);
        });
    }
}

module.exports = CPUHandler;