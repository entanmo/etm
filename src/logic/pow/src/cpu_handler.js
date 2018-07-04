'use strict';

const Handler = require('./handler');

class CPUHandler extends Handler {
    constructor() {
        super();
        this._state = Handler.PowState.PENDING;
        this._blockLoop = 100000;
    }

    pow(src, target, cb) {
        if (this._state === Handler.PowState.RUNNING) {
            return setImmediate(() => {
                cb('Error: PoW is running.');
            });
        }
        this._state = Handler.PowState.RUNNING;
        let nonce = 0;
        const self = this;

       (function _pow() {
            if (self._state === Handler.PowState.PENDING) {
                return ;
            }
            for (let i = 0; i < self._blockLoop; i++) {
                const hash = Handler.sha256(src + nonce.toString()).digest('hex');
                if (hash.indexOf(target) === 0) {
                    self._state = Handler.PowState.PENDING;
                    return cb(null, {
                        hash: hash,
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
        if (this._state === Handler.PowState.PENDING) {
            return setImmediate(() => {
                cb(null, Handler.PowState.PENDING);
            });
        }

        this._state = Handler.PowState.PENDING;
        setImmediate(() => {
            cb(null, Handler.PowState.RUNNING);
        });
    }
}

module.exports = CPUHandler;