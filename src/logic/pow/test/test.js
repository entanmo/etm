'use strict';

const PoW = require('../../pow');

const powResponser = {
    onError: function (uuid, data) {
        /**
         * data - { reason: err }
         */
        console.log('onError: ', uuid);
    },

    onTimeout: function (uuid, data) {
        /**
         * data - { desc: desc }
         */
        console.log('onTimeout: ', uuid);
    },

    onStartPoW: function (uuid, data) {
        /**
         * data - null
         */
        console.log('onStartPoW: ', uuid);
    },

    onStopPoW: function (uuid, data) {
        /**
         * data - null
         */
        console.log('onStopPoW: ', uuid);
    },

    onTermPoW: function (uuid, data) {
        /**
         * data - null
         */
        console.log('onTermPoW: ', uuid);
    },

    onPoW: function (uuid, data) {
        /**
         * data - { src: src, target: target, hash: powhash, nonce: nonce }
         */
        console.log('onPoW: ', uuid, data.src, data.target, data.hash, data.nonce);
    },

    onState: function (uuid, data) {
        /**
         * data - { state: state }
         */
        console.log('onState: ', uuid);
        if (data.state == PoW.PowState.PENDING) {
            console.log('pending state.');
        } else if (data.state == PoW.PowState.RUNNING) {
            console.log('running state.');
        } else {
            console.log('unknown state.');
        }
    }
}

/**
 * 设置回调响应对象, 参数powResponser
 * onError:         出现错误时进行回调
 * onTimeout:       超时时进行回调
 * onStartPoW:      pow开始进行计算
 * onStopPoW:       pow正常结束计算
 * onTermPoW:       pow被中止计算
 * onPoW:           pow计算结果
 * onState:         当前pow系统状态查询[running, pending]
 */
PoW.setResponser(powResponser);

/**
 * 循环十次pow测试，
 * 每次执行PoW.pow()操作时，如果此时还有pow处理运算状态，则会中断当前的pow计算过程
 */
const origin = 'hello world';
for (let i = 0; i < 10; i++) {
    const src = origin + Math.floor(Math.random() * 99999999).toString(16);
    const target = '00000';
    const timeout = 3 * 1000;
    PoW.pow(src, target, timeout);
}

/**
 * 查询当前的pow运行状态
 * running
 * pending
 */
setTimeout(() => {
    PoW.state();        // onState
}, 10 * 1000);

/**
 * 先执行难度值较高的pow运算
 */
setTimeout(() => {
    PoW.pow('hello world', '00000000'/**, 2 * 1000*/);     // onStartPoW

    /**
     * 3秒后查询当前的pow状态，此时应该是处于running
     */
    setTimeout(() => {
        PoW.state();        // onState

        /**
         * 再过3秒之后停止pow运算
         */
        setTimeout(() => {
            PoW.stop();         // onTermPoW
        }, 3 * 1000);
    }, 3 * 1000);
}, 20 * 1000);