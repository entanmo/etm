'use strict';

const { PowState, OperationReq, OperationResp } = require('./constants');

/*
class Handler {
    pow(src, target, cb) {
        // TODO
    }

    getState() {
        // TODO
    }

    pending(cb) {
        // TODO
    }
}
*/

function noop() {
    // Nothing to do
}

const path = require('path');
const fs = require('fs');
const MINER_CFG = path.resolve('miner-cfg.json');

class PowImpl {
    constructor() {
        // 1、判断配置矿机配置文件是否存在
        if (fs.existsSync(MINER_CFG)) {
            // 2、读取矿机配置文件
            const minerCfg = require(MINER_CFG);
            // 3、判断是否使用GPU
            if (minerCfg.enableGPU) {
                const GPUHandler = require('./gpu_handler');
                this._handler = new GPUHandler();
                if (!this._handler.setup(MINER_CFG)) {
                    // 4、GPU功能失败的情况下使用CPU
                    const CPUHandler = require('./cpu_handler');
                    this._handler = new CPUHandler();
                }
            }
        } else {
            // 5、如果未进行配置，则默认使用CPU
            const CPUHandler = require('./cpu_handler');
            this._handler = new CPUHandler();
        }
        // 6、发送准备就绪消息
        setImmediate(() => {
            this._opResp(null, OperationResp.MINT_READY, null);
        });

        /*
        // init with GPUHandler by default
        this._handler = new GPUHandler();
        if (!this._handler.setup()) {
            this._handler = new CPUHandler();
        }
        setImmediate(() => {
            this._opResp(null, OperationResp.MINT_READY, null);
        });
        // this._handler = new CPUHandler();
        */
        this._ipcHandlers = {};
        this._bindIpcHandlers();
        this._timeoutHandler = null;
    }

    currentState() {
        return this._handler.getState();
    }

    isRunning() {
        return this._handler.getState() === PowState.RUNNING;
    }

    isPending() {
        return this._handler.getState() === PowState.PENDING;
    }

    stop(cb) {
        if (this._timeoutHandler) {
            // console.log('clearTimeout');
            clearTimeout(this._timeoutHandler);
            this._timeoutHandler = null;
        }
        this._handler.pending(cb);
    }

    pow(uuid, src, target, timeout) {
        const self = this;
        function _doPoW() {  
            self._opResp(uuid, OperationResp.START_POW, null);
            /*
            self._promisifyPow(src, target, timeout)
                .then((data) => {
                    console.log((new Date()).getTime(), "-------------------------- onPow callback", data);
                    if (data.opstate === 'timeout') {
                        self._opResp(uuid, OperationResp.TIMEOUT, {
                            desc: `timeout of ${timeout}ms with ${uuid}`
                        });
                    } else {
                        self._opResp(uuid, OperationResp.POW, {
                            src: data.src,
                            target: data.target,
                            hash: data.hash,
                            nonce: data.nonce,
                        });
                    }
                    self._opResp(uuid, OperationResp.STOP_POW, null);
                })
                .catch((err) => {
                    self._opResp(uuid, OperationResp.ERROR, {
                        reason: err
                    });
                    self._opResp(uuid, OperationResp.STOP_POW, null);
                });
                */
            self.mint(src, target, timeout, (err, result) => {
                if (err) {
                    self._opResp(uuid, OperationResp.ERROR, {
                        reason: err
                    });
                    return;
                }

                if (result.opstate === "timeout") {
                    self._opResp(uuid, OperationResp.TIMEOUT, {
                        desc: `timeout of ${timeout}ms with ${uuid}`
                    });
                } else {
                    self._opResp(uuid, OperationResp.POW, {
                        src: result.src,
                        target: result.target,
                        hash: result.hash,
                        nonce: result.nonce,
                    });
                }
            });
        }

        if (this.isRunning()) {
            return this.stop((err, state) => {
                if (err) {
                    // Error
                    return this._opResp(uuid, OperationResp.ERROR, {
                        reason: new Error('stop pow error.')
                    });
                }
                if (state === PowState.RUNNING) {
                    this._opResp(uuid, OperationResp.TERM_POW, null);
                }
                _doPoW();
            });
        }

        _doPoW();
    }

    mint(src, target, timeout, cb) {
        if (typeof timeout !== "number") {
            timeout = 0;
        }

        let localCallback = cb;
        if (timeout <= 0) {
            this._handler.pow(src, target, (err, result) => {
                if (err) {
                    return localCallback(err);
                }

                localCallback(null, {
                    opstate: 'pow',
                    src: src,
                    target: target,
                    hash: result.hash,
                    nonce: result.nonce
                });
            });
        } else {
            const timer = process.hrtime();
            function timeouthandler() {
                if (!localCallback || typeof localCallback !== "function") {
                    return;
                }

                const duration = process.hrtime(timer);
                if (duration[0] * 1000 + duration[1] / 1000000 >= timeout) {
                    localCallback({
                        opstate: 'timeout',
                    });
                    localCallback = undefined;
                }   

                setTimeout(timeouthandler, 100);
            }
            setTimeout(timeouthandler, 100);

            this._handler.pow(src, target, (err, result) => {
                if (localCallback && typeof localCallback === "function") {
                    if (err) {
                        return localCallback(err);
                    }

                    localCallback(null, {
                        opstate: 'pow',
                        src: src,
                        target: target,
                        hash: result.hash,
                        nonce: result.nonce
                    });
                    localCallback = undefined;
                }
            });
        }
    }

    _promisifyPow(src, target, timeout) {
        // console.log([src, target, timeout]);
        // emit start_pow event

        if (typeof timeout !== 'number') {
            timeout = 0;
        }

        if (timeout <= 0) {
            // No timeout
            return new Promise((resolve, reject) => {
                this._handler.pow(src, target, (err, data) => {
                    console.log((new Date()).getTime(), "---------------- pow back: ", err, data);
                    if (err) {
                        return reject(err);
                    }

                    resolve({
                        opstate: 'pow',
                        src: src,
                        target: target,
                        hash: data.hash,
                        nonce: data.nonce
                    });
                    console.log((new Date()).getTime(), '---------------------- pow back end.');
                });
            });
        } else {
            return Promise.race([
                Promise.resolve(new Promise((resolve, reject) => {
                    this._timeoutHandler = setTimeout(() => {
                        this._timeoutHandler = null;
                        this.stop(noop);
                        resolve({
                            opstate: 'timeout',
                        });
                    }, timeout);
                })),
                new Promise((resolve, reject) => {
                    this._handler.pow(src, target, (err, data) => {
                        console.log((new Date()).getTime(), "----------------- pow race back: ", err, data);
                        if (err) {
                            return reject(err);
                        }

                        resolve({
                            opstate: 'pow',
                            src: src,
                            target: target,
                            hash: data.hash,
                            nonce: data.nonce
                        });
                    });
                })
            ]);
        }
    }

    ///////////////////////////////////////////////////////////////////////////
    _bindIpcHandlers() {
        this._ipcHandlers[OperationReq.START_POW] = this.opStartPoW.bind(this);
        this._ipcHandlers[OperationReq.STOP_POW] = this.opStopPoW.bind(this);
        this._ipcHandlers[OperationReq.GET_STATE] = this.opGetState.bind(this);
    }

    ipcHandler(uuid, op, params) {
        const handler = this._ipcHandlers[op];
        if (handler == null) {
            this.opError(uuid, op, new Error("Unsupported operation."));
            return;
        }

        handler(uuid, params);
    }

    // op handlers
    opStartPoW(uuid, params) {
        this.pow(uuid, params.src, params.target, params.timeout || 0);
    }

    opStopPoW(uuid, params) {
        if (this.isRunning()) {
            this.stop((err) => {
                if (err) {
                    return this._opResp(uuid, OperationResp.ERROR, {
                        reason: new Error('Error: stop pow process error.')
                    });
                }

                this._opResp(uuid, OperationResp.TERM_POW, null);     // TODO
            });
        }
    }

    opGetState(uuid, params) {
        const state = this.currentState();
        this._opResp(uuid, OperationResp.STATE, {
            state: state,
        });
    }

    opError(uuid, opType, err) {
        this._opResp(uuid, OperationResp.ERROR, {
            reason: err
        });
    }

    _opResp(uuid, opResp, data) {
        setImmediate(() => {
            process.send({
                uuid: uuid,
                opresp: opResp,
                data: data
            });
        });
    }
}

const powImpl = new PowImpl();

process.on('message', (ipcReq) => {
    // console.log('ipcReq: ', ipcReq);
    const uuid = ipcReq.uuid;
    const op = ipcReq.opreq;
    const params = ipcReq.params;
    powImpl.ipcHandler(uuid, op, params);
});