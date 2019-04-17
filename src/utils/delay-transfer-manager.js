"use strict";

const async = require("async");

/**
 * 延迟到账交易管理器
 * 
 * @class
 */
class DelayTransferManager {
    /**
     * 构造函数
     * 
     * @constructor
     */
    constructor() {
        this.delayTransferCaches = new Map();
        this.commitCaches = new Array();
    }

    /**
     * 打印当前缓存的延迟交易信息
     * 
     * @method
     * 
     */
    showLog() {
        const logs = [];
        const entries = this.delayTransferCaches.entries();
        for (let [_, value] of entries) {
            logs.push(value);
        }
        console.log(JSON.stringify(logs, null, 2));
    }

    /**
     * 添加延迟交易记录
     * @method
     * 
     * @param {string} trId - 交易Id
     * @param {object} data - 交易记录
     * @param {string} data.id - 交易id
     * @param {string} data.senderId - 发送者
     * @param {string} data.recipientId - 接收者
     * @param {number} data.amount - 金额数
     * @param {number} data.expired - 延迟点
     * 
     * @returns {boolean} true: 添加成功; false: 添加失败
     */
    addDelayTransfer(trId, data) {
        if (this.delayTransferCaches.has(trId)) {
            return false;
        }
        this.delayTransferCaches.set(trId, data);
        return true;
    }

    /**
     * 移除延迟交易记录
     * @method
     * 
     * @param {string} trId - 交易Id
     * 
     * @returns {boolean} true: 移除成功; false: 移除失败
     */
    removeDelayTransfer(trId) {
        if (this.delayTransferCaches.has(trId)) {
            return false;
        }

        this.delayTransferCaches.delete(trId);
        return true;
    }

    /**
     * 获取所有以指定账号地址为接收者的延迟交易列表
     * 
     * @method
     * 
     * @param {string} id - 账号地址
     * 
     * @returns {array} - 延迟交易列表
     */
    listByRecipientId(id) {
        const returnResults = [];
        this.delayTransferCaches.forEach(data => {
            if (data.recipientId === id) {
                returnResults.push(data);
            }
        });

        return returnResults;
    }

    /**
     * 获取所有以指定账号地址为发送者的延迟交易列表
     * 
     * @method
     * 
     * @param {string} id - 账号地址
     * 
     * @returns {array} - 延迟交易列表
     */
    listBySenderId(id) {
        const returnResults = [];
        this.delayTransferCaches.forEach(data => {
            if (data.senderId === id) {
                returnResults.push(data);
            }
        })
        return returnResults;
    }

    /**
     * 获取指定账号地址的总的延迟交易金额
     * 
     * @method
     * 
     * @param {string} id - 账号地址
     * 
     * @returns {boolean} - 总的延迟交易金额
     */
    totalAmount(id) {
        const results = this.listByRecipientId(id);
        let totalAmount = 0;
        results.forEach(el => {
            totalAmount += el.amount;
        });
        return totalAmount;
    }

    /**
     * 处理新块成功后，用于清空提交的缓存
     * 
     * @method
     */
    commit() {
        this.commitCaches = new Array();
    }

    /**
     * 处理新块失败后，用于回退提交的缓存记录
     * 
     * @method
     */
    rollback() {
        this.commitCaches.forEach(el => {
            this.delayTransferCaches.set(el.transactionId, el);
        });
        this.commitCaches = new Array();
    }

    async backwardTick(block) {
        const self = this;
        return new Promise((resolve, reject) => {
            library.model.getAllAppliedDelayTransfer(block.height, (err, results) => {
                if (err) {
                    return reject(err);
                }

                async.eachSeries(results, (delayTransfer, cb) => {
                    let { transactionId, senderId, recipientId, amount, expired } = delayTransfer;
                    const key = transactionId;
                    const data = { transactionId, senderId, recipientId, amount, expired };
                    this.delayTransferUnaction(key, data, block)
                        .then(() => {
                            self.addDelayTransfer(key, data);
                            cb();
                        })
                        .catch(error => {
                            cb(error);
                        });
                }, err => {
                    return err ? reject(err) : resolve();
                });
            });
        });
    }

    /**
     * 新块产生时，用于处理延迟提交交易
     * @method
     * @async
     * 
     * @param {object} block - 区块对象
     * 
     * @returns {Promise} - 处理结果Promise
     */
    async blockTick(block) {
        const commited = new Array();
        {
            const keys = this.delayTransferCaches.keys();
            const logKeys = [];
            for (let key of keys) {
                const data = this.delayTransferCaches.get(key);
                logKeys.push({
                    id: key,
                    expired: data.expired,
                    blockHeight: block.height,
                });
            }
            console.log("blockTick:", JSON.stringify(logKeys, null, 2));
        }

        const keys = this.delayTransferCaches.keys();
        for (let key of keys) {
            const data = this.delayTransferCaches.get(key);
            if (data.expired != block.height) {
                continue;
            }
            await this.delayTransferAction(key, data, block);
            commited.push(data);
        }
        commited.forEach(el => {
            this.delayTransferCaches.delete(el.transactionId);
            this.commitCaches.push(el);
        });
    }

    /**
     * 处理延迟记录与账号数据更新
     * 
     * @method
     * @async
     * @inner
     * 
     * @param {string} key - 交易key
     * @param {object} data - 延迟交易数据
     * @param {object} block - 区块对象
     * 
     * @returns {Promise} - 处理结果Promise对象
     */
    async delayTransferAction(key, data, block) {
        return new Promise((resolve, reject) => {
            library.dbLite.query(
                "UPDATE delay_transfer SET state=1 WHERE transactionId=$transactionId", {
                    transactionId: key
                }, err => {
                    if (err) {
                        return reject(err);
                    }

                    library.modules.accounts.setAccountAndGet({
                        address: data.recipientId
                    }, (err, recipient) => {
                        if (err) {
                            return reject(err);
                        }

                        library.modules.accounts.mergeAccountAndGet({
                            address: recipient.address,
                            balance: data.amount,
                            u_balance: data.amount,
                            blockId: block.id,
                            round: library.modules.round.calc(block.height)
                        }, err => {
                            return err ? reject(err) : resolve();
                        });
                    });
                });
        });
    }

    async delayTransferUnaction(key, data, block) {
        return new Promise((resolve, reject) => {
            library.dbLite.query("UPDATE delay_transfer SET state = 1 WHERE transactiondId=$transactionId", {
                transactionId: key
            }, err => {
                if (err) {
                    return reject(err);
                }

                library.modules.accounts.setAccountAndGet({
                    address: data.recipientId
                }, (err, recipient) => {
                    if (err) {
                        return reject(err);
                    }

                    library.modules.accounts.mergeAccountAndGet({
                        address: recipient.address,
                        balance: -data.amount,
                        u_balance: -data.amount,
                        blockId: block.id,
                        round: library.modules.round.calc(block.height)
                    }, err => {
                        return err ? reject(err) : resolve();
                    });
                });
            });
        });
    }
}

module.exports = DelayTransferManager;