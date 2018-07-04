'use strict';

const crypto = require('crypto');
const { PowState } = require('./constants');

/**
 * 
 */

class Handler {
    pow(src, target, cb) {
        throw new Error('function[pow] must be implemented by subclass')
    }

    getState() {
        throw new Error('function[getState] must be implemented by subclass');
    }

    pending(cb) {
        throw new Error('function[pending] must be implemented by subclass');
    }
}

Handler.PowState = PowState;
Handler.crypto = crypto;
Handler.sha256 = function (src) {
    return crypto.createHash('sha256').update(src);
}

module.exports = Handler;