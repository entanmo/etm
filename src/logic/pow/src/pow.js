'use strict';

const path = require('path');
const { fork } = require('child_process');
const { OperationReq, OperationResp } = require('./constants');
const powImpl = fork(path.resolve(__dirname, 'pow_impl.js'));

let onReadyEvent = null;
let powResponser = {};

powImpl.request = function (uuid, op, params, cb) {
    const reqData = {
        uuid: uuid,
        opreq: op,
        params: params
    };
    this.send(reqData, (err) => {
        if (err) {
            return cb(err);
        }
        
        cb(null);
    });
}


powImpl.onErrorEvent = function onerrorevent(uuid, resp) {
    if (powResponser.onError) {
        powResponser.onError(uuid, resp.data);
    }
}

powImpl.onTimeoutEvent = function ontimeoutevent(uuid, resp) {
    if (powResponser.onTimeout) {
        powResponser.onTimeout(uuid, resp.data);
    }
}

powImpl.onStartPoWEvent = function onstartpowevent(uuid, resp) {
    if (powResponser.onStartPoW) {
        powResponser.onStartPoW(uuid, resp.data);
    }
}

powImpl.onStopPoWEvent = function onstoppowevent(uuid, resp) {
    if (powResponser.onStopPoW) {
        powResponser.onStopPoW(uuid, resp.data);
    }
}

powImpl.onTermPoWEvent = function ontermpowevent(uuid, resp) {
    if (powResponser.onTermPoW) {
        powResponser.onTermPoW(uuid, resp.data);
    }
}

powImpl.onPoWEvent = function onpowevent(uuid, resp) {
    if (powResponser.onPoW) {
        powResponser.onPoW(uuid, resp.data);
    }
}

powImpl.onStateEvent = function onstateevent(uuid, resp) {
    if (powResponser.onState) {
        powResponser.onState(uuid, resp.data);
    }
}

function _onprocesserror(uuid) {
    return (err) => {
        if (err) {
            setImmediate(() => {
                const resp = powImpl.responser;
                if (resp && typeof resp['onerror'] === 'function') {
                    resp.onerror(err);
                }
            });
        }
    }
}

powImpl.mapresponsehandlers = {}
powImpl.mapresponsehandlers[OperationResp.ERROR] = powImpl.onErrorEvent.bind(powImpl);
powImpl.mapresponsehandlers[OperationResp.TIMEOUT] = powImpl.onTimeoutEvent.bind(powImpl);
powImpl.mapresponsehandlers[OperationResp.START_POW] = powImpl.onStartPoWEvent.bind(powImpl);
powImpl.mapresponsehandlers[OperationResp.STOP_POW] = powImpl.onStopPoWEvent.bind(powImpl);
powImpl.mapresponsehandlers[OperationResp.TERM_POW] = powImpl.onTermPoWEvent.bind(powImpl);
powImpl.mapresponsehandlers[OperationResp.POW] = powImpl.onPoWEvent.bind(powImpl);
powImpl.mapresponsehandlers[OperationResp.STATE] = powImpl.onStateEvent.bind(powImpl);

powImpl.on('message', (ipcResp) => {
    // console.log('ipcResp: ', ipcResp);

    const opResp = ipcResp.opresp;
    const uuid = ipcResp.uuid;
    if (opResp === OperationResp.MINT_READY) {
        if (onReadyEvent || typeof onReadyEvent === "function") {
            onReadyEvent();
        }
        return;
    }
    const handler = powImpl.mapresponsehandlers[opResp];
    if (handler != null) {
        return handler(uuid, ipcResp);
    }

    console.log(`Error: Unsupported Response operation[${opResp}]`);
});

powImpl.on('error', (err) => {
    powImpl.onErrorEvent(-1, {
        reason: err
    });
});


powImpl.on('exit', (code, signal) => {
    powImpl.onErrorEvent(-1, {
        reason: new Error(`Error: eixt with code(${code}), signal(${signal})`)
    });
})

let gCurrentUUID = 0;
module.exports = {
    onReady: function (cb) {
        // cb();
        onReadyEvent = cb;
    },
    
    pow: function (src, target, timeout, powEvents) {
        // TODO: validate src, target, timeout
        powResponser = {};
        if (powEvents) {
            // onError
            if (powEvents.onError && typeof powEvents.onError === "function") {
                powResponser.onError = powEvents.onError;
            }
            // onTimeout
            if (powEvents.onTimeout && typeof powEvents.onTimeout === "function") {
                powResponser.onTimeout = powEvents.onTimeout;
            }
            // onStartPoW
            if (powEvents.onStartPoW && typeof powEvents.onStartPoW === "function") {
                powResponser.onStartPoW = powEvents.onStartPoW;
            }
            // onStopPoW
            if (powEvents.onStopPoW && typeof powEvents.onStopPoW === "function") {
                powResponser.onStopPoW = powEvents.onStopPoW;
            }
            // onTermPoW
            if (powEvents.onTermPoW && typeof powEvents.onTermPoW === "function") {
                powResponser.onTermPoW = powEvents.onTermPoW;
            }
            // onPoW
            if (powEvents.onPoW && typeof powEvents.onPoW === "function") {
                powResponser.onPoW = powEvents.onPoW;
            }
            // onState
            if (powEvents.onState && typeof powEvents.onState === "function") {
                powResponser.onState = powEvents.onState;
            }
        }
        
        if (timeout == null) {
            timeout = 0;
        }
        const uuid = gCurrentUUID++;
        // TODO
        powImpl.request(uuid, OperationReq.START_POW, {
            src: src,
            target: target,
            timeout: timeout
        }, _onprocesserror(uuid));
        return uuid;
    },

    stop: function () {
        const uuid = gCurrentUUID++;
        powImpl.request(uuid, OperationReq.STOP_POW, null, _onprocesserror(uuid));
        return uuid;
    },

    state: function () {
        const uuid = gCurrentUUID++;
        powImpl.request(uuid, OperationReq.GET_STATE, null, _onprocesserror(uuid));
        return uuid;
    }
}