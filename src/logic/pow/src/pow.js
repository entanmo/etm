'use strict';

const path = require('path');
const { fork } = require('child_process');
const { OperationReq, OperationResp } = require('./constants');
const powImpl = fork(path.resolve(__dirname, 'pow_impl.js'));

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
    if (this.responser && typeof this.responser['onError'] === 'function') {
        this.responser.onError(uuid, resp.data);
    }
}

powImpl.onTimeoutEvent = function ontimeoutevent(uuid, resp) {
    if (this.responser && typeof this.responser['onTimeout'] === 'function') {
        this.responser.onTimeout(uuid, resp.data);
    }
}

powImpl.onStartPoWEvent = function onstartpowevent(uuid, resp) {
    if (this.responser && typeof this.responser['onStartPoW'] === 'function') {
        this.responser.onStartPoW(uuid, resp.data);
    }
}

powImpl.onStopPoWEvent = function onstoppowevent(uuid, resp) {
    if (this.responser && typeof this.responser['onStopPoW'] === 'function') {
        this.responser.onStopPoW(uuid, resp.data);
    }
}

powImpl.onTermPoWEvent = function ontermpowevent(uuid, resp) {
    if (this.responser && typeof this.responser['onTermPoW'] === 'function') {
        this.responser.onTermPoW(uuid, resp.data);
    }
}

powImpl.onPoWEvent = function onpowevent(uuid, resp) {
    if (this.responser && typeof this.responser['onPoW'] === 'function') {
        this.responser.onPoW(uuid, resp.data);
    }
}

powImpl.onStateEvent = function onstateevent(uuid, resp) {
    if (this.responser && typeof this.responser['onState'] === 'function') {
        this.responser.onState(uuid, resp.data);
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

powImpl.responser = null;
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
    setResponser: function (responser) {
        powImpl.responser = responser;
        module.exports.currentResponser = powImpl.responser;
    },

    getResponser: function () {
        return powImpl.responser;
    },
    
    pow: function (src, target, timeout) {
        // TODO: validate src, target, timeout
        
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