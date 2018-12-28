/*
 * Copyright © 2018 EnTanMo Foundation
 *
 * See the LICENSE file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with the EnTanMo Foundation,
 * no part of this software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE file.
 *
 * Removal or modification of this copyright notice is prohibited.
 */

"use strict";

var crypto = require('crypto');
var async = require("async");
var ed = require('../utils/ed.js');
var Router = require('../utils/router.js');
var TransactionTypes = require('../utils/transaction-types.js');
var sandboxHelper = require('../utils/sandbox.js');
var addressHelper = require('../utils/address.js');
var slots = require("../utils/slots");
const _ = require("lodash");

const LockVotes = require("../logic/lock_votes");
const UnlockVotes = require("../logic/unlock_votes");

var modules, library, self, __private = {}, shared = {};

function LockVote(cb, scope) {
    library = scope;
    self = this;
    self.__private = __private
    __private.attachApi();

    library.base.transaction.attachAssetType(TransactionTypes.LOCK_VOTES, new LockVotes());
    library.base.transaction.attachAssetType(TransactionTypes.UNLOCK_VOTES, new UnlockVotes());

    setImmediate(cb, null, self);
}

__private.attachApi = function () {
    var router = new Router();

    router.use(function (req, res, next) {
        if (modules) return next();
        res.status(500).send({ success: false, error: "Blockchain is loading" });
    });

    router.map(shared, {
        "get /get": "getLockVote",
        "get /all": "getAllLockVotes",
        "get /:id": "getLockVote",      // this route must be the last get method
        "put /": "putLockVote",
        "put /remove": "removeLockVote"
    });

    router.use(function (req, res, next) {
        res.status(500).send({ success: false, error: "API endpoint not found" });
    });

    library.network.app.use("/api/lockvote", router);
    library.network.app.use(function (err, req, res, next) {
        if (!err) return next();
        library.logger.error(req.url, err.toString());
        res.status(500).send({ success: false, error: err.toString() });
    });
}

__private.getLockVote = function (id, cb) {
    library.dbLite.query("select t.id, b.height, t.blockId, t.type, t.timestamp, lower(hex(t.senderPublicKey)), " +
        "t.senderId, t.recipientId, t.amount, t.fee, lower(hex(t.signature)), lower(hex(t.signSignature)), " +
        "lv.address, lv.originHeight, lv.currentHeight, lv.lockAmount, lv.state, " +
        "(select max(height) + 1 from blocks) - b.height " +
        "from trs t " +
        "inner join blocks b on t.blockId = b.id " +
        "inner join lock_votes lv on lv.transactionId = t.id " +
        "where t.id = $id",
        { id: id },
        [
            't_id', 'b_height', 't_blockId', 't_type', 't_timestamp', 't_senderPublicKey',
            't_senderId', 't_recipientId', 't_amount', 't_fee', 't_signature', 't_signSignature',
            'lv_address', 'lv_originHeight', 'lv_currentHeight', 'lv_lockAmount', 'lv_state', 'confirmations'
        ],
        function (err, rows) {
            if (err) {
                return cb(err);
            }

            if (rows.length <= 0) {
                return cb(null, null);
            }

            var transacton = library.base.transaction.dbRead(rows[0]);
            cb(null, transacton);
        });
}

__private.listLockVotes = function (query, cb) {
    let condSql = "";
    if (typeof query.state === "number") {
        if (query.state === 0) {
            condSql = " and lv.state = 0";
        } else if (query.state === 1) {
            condSql = " and lv.state = 1";
        }
    }
    library.dbLite.query("select t.id, b.height, t.blockId, t.type, t.timestamp, lower(hex(t.senderPublicKey)), " +
        "t.senderId, t.recipientId, t.amount, t.fee, lower(hex(t.signature)), lower(hex(t.signSignature)), " +
        "lv.address, lv.originHeight, lv.currentHeight, lv.lockAmount, lv.vote, lv.state, " +
        "(select max(height) + 1 from blocks) - b.height " +
        "from trs t " +
        "inner join blocks b on t.blockId = b.id " +
        "inner join lock_votes lv on lv.transactionId = t.id " +
        "where lv.address = $address" + condSql,
        { address: query.address },
        [
            't_id', 'b_height', 't_blockId', 't_type', 't_timestamp', 't_senderPublicKey',
            't_senderId', 't_recipientId', 't_amount', 't_fee', 't_signature', 't_signSignature',
            'lv_address', 'lv_originHeight', 'lv_currentHeight', 'lv_lockAmount', "lv_vote", 'lv_state', 'confirmations'
        ],
        function (err, rows) {
            if (err) {
                return cb(err);
            }

            if (rows.length <= 0) {
                return cb(null, { trs: [], count: 0});
            }

            let trs = [];
            for (let i = 0; i < rows.length; i++) {
                let transaction = library.base.transaction.dbRead(rows[i]);
                if (transaction) {
                    trs.push(transaction);
                }
            }

            cb(null, { trs: trs, count: trs.length });
        });
}

__private.calcVoteFactor = function (lockVoteInfo, blockHeight) {
    if (lockVoteInfo.state == 0) {
        return 0;
    }

    const originHeight = lockVoteInfo.originHeight;
    let currentHeight = lockVoteInfo.currentHeight;
    if (originHeight != 1) {
        if (originHeight == currentHeight) {
            currentHeight = currentHeight + slots.getHeightPerDay();
        }
        if (blockHeight < currentHeight) {
            return 0;
        }
    }

    let factor = 1 + Math.floor((blockHeight - currentHeight) / slots.getHeightPerDay());
    return Math.min(32, Math.max(1, factor));
}

__private.calcNumOfVotes = function (lockVoteInfo, blockHeight) {
    return lockVoteInfo.lockAmount * __private.calcVoteFactor(lockVoteInfo, blockHeight);
}

__private.calcNumOfVotesWithFactor = function (lockVoteInfo, factor) {
    return lockVoteInfo.lockAmount * factor;
}

// Public methods

LockVote.prototype.sandboxApi = function (call, args, cb) {
    sandboxHelper.callMethod(shared, call, args, cb);
}

LockVote.prototype.listLockVotes = function (query, cb) {
    __private.listLockVotes(query, cb);
}

LockVote.prototype.getLockVote = function (id, cb) {
    __private.getLockVote(id, cb);
}

LockVote.prototype.updateLockVotes = function (address, blockHeight, rate, cb) {
    if (rate < 0 || rate > 1) {
        return cb(new Error("Invalid rate"));
    }

    __private.listLockVotes({address: address, state: 1}, (err, result) => {
        if (err) {
            return cb(err);
        }

        if (result.count <= 0) {
            return cb(null);
        }

        async.eachSeries(result.trs, (value, cb) => {
            const info = value.asset;
            let currentHeight = info.currentHeight;
            if (info.originHeight == info.currentHeight) {
                currentHeight = info.currentHeight + slots.getHeightPerDay();
            }
            if (blockHeight < currentHeight) {
                return cb();
            }

            const deltaHeight = Math.ceil((blockHeight - currentHeight) * rate);
            const newHeight = currentHeight + deltaHeight;
            library.dbLite.query("UPDATE lock_votes SET currentHeight=$currentHeight where transactionId = $transactionId and state = 1",{
                currentHeight: newHeight,
                transactionId: value.id
            }, cb);
        }, (err) => {
            return cb(err);
        });
    });
}

LockVote.prototype.refreshRoundLockVotes = function (address, blockHeight, cb) {
    __private.listLockVotes({address: address, state: 1}, (err, result) => {
        if (err) {
            return cb(err);
        }

        if (result.count <= 0) {
            return cb();
        }

        let totalVotes = 0;

        // 将延迟到账的金额加入到总票数里面
        totalVotes += library.delayTransferMgr.totalAmount(address);

        async.eachSeries(result.trs, (value, cb) => {
            const numOfVote = __private.calcNumOfVotes(value.asset, blockHeight);
            library.dbLite.query("UPDATE lock_votes SET vote=$vote where transactionId = $transactionId and state = 1",{
                vote: numOfVote,
                transactionId: value.id
            }, err => {
                if (err) {
                    return cb(err);
                }

                totalVotes += numOfVote;
                cb();
            });
            /*
            totalVotes += numOfVote;
            cb();
            */
        }, (err) => {
            if (err) {
                return cb(err);
            }
            
            return cb(null, totalVotes);
        });
    });
}

LockVote.prototype.calcLockVotes = function (address, blockHeight, cb) {
    __private.listLockVotes({address: address, state: 1}, (err, result) => {
        if (err) {
            return cb(err);
        }

        if (result.count <= 0) {
            return cb();
        }

        let totalVotes = 0;
        // 将延迟到账的金额加入到总票数里面
        totalVotes += library.delayTransferMgr.totalAmount(address);

        async.eachSeries(result.trs, (value, cb) => {
            const numOfVote = __private.calcNumOfVotes(value.asset, blockHeight);
            totalVotes += numOfVote;
            cb();
        }, (err) => {
            if (err) {
                return cb(err);
            }
            return cb(null, totalVotes);
        });
    });
}

// Events
LockVote.prototype.onBind = function (scope) {
    modules = scope;
}

// Shared

shared.putLockVote = function (req, cb) {
    var body = req.body;
    library.scheme.validate(body, {
        type: "object",
        properties: {
            secret: {
                type: "string",
                minLength: 1,
                maxLength: 100
            },
            publicKey: {
                type: "string",
                format: "publicKey"
            },
            secondSecret: {
                type: "string",
                minLength: 1
            },
            multisigAccountPublicKey: {
                type: "string",
                format: "publicKey"
            },
            args: {
                type: 'array',
                minLength: 1,
                maxLength: 1,
                uniqueItems: true
            }
        },
        required: ["secret", "args"]
    }, function (err) {
        if (err) {
            return cb(err[0].toString());
        }

        var hash = crypto.createHash("sha256").update(body.secret, "utf8").digest();
        var keypair = ed.MakeKeypair(hash);

        if (body.publicKey) {
            if (keypair.publicKey.toString("hex") != body.publicKey) {
                return cb("Invalid passphrase");
            }
        }

        library.balancesSequence.add(function (cb) {
            if (body.multisigAccountPublicKey && body.multisigAccountPublicKey != keypair.publicKey.toString("hex")) {
                modules.accounts.getAccount({ publicKey: body.multisigAccountPublicKey }, function (err, account) {
                    if (err) {
                        return cb(err.toString());
                    }

                    if (!account) {
                        return cb("Multisignature account not found");
                    }

                    if (!account.multisignatures) {
                        return cb("Account does not has multisignatures enabled");
                    }

                    if (account.multisignatures.indexOf(keypair.publicKey.toString("hex")) < 0) {
                        return cb("Account does not belong to multisignature group");
                    }

                    modules.accounts.getAccount({ publicKey: keypair.publicKey }, function (err, requester) {
                        if (err) {
                            return cb(err.toString());
                        }

                        if (!requester || !requester.publicKey) {
                            return cb("Invalid requester")
                        }

                        if (requester.secondSignature && !body.secondSecret) {
                            return cb("Invalid second passphrase");
                        }

                        if (requester.publicKey == account.publicKey) {
                            return cb("Invalid requester");
                        }

                        var secondKeypair = null;
                        if (requester.secondSignature) {
                            var secondHash = crypto.createHash("sha256").update(body.secondSecret, "utf8").digest();
                            secondKeypair = ed.MakeKeypair(secondHash);
                        }

                        try {
                            var transaction = library.base.transaction.create({
                                type: TransactionTypes.LOCK_VOTES,
                                sender: account,
                                keypair: keypair,
                                requester: keypair,
                                secondKeypair: secondKeypair,
                                args: body.args || []
                            });
                        } catch (e) {
                            return cb(e.toString());
                        }

                        modules.transactions.receiveTransactions([transaction], cb);
                    });
                });
            } else {
                modules.accounts.getAccount({ publicKey: keypair.publicKey.toString("hex") }, function (err, account) {
                    if (err) {
                        return cb(err.toString());
                    }

                    if (!account) {
                        return cb("Account not found");
                    }

                    if (account.secondSignature && !body.secondSecret) {
                        return cb("Invalid second passphrase");
                    }

                    var secondKeypair = null
                    if (account.secondSignature) {
                        var secondHash = crypto.createHash("sha256").update(body.secondSecret, "utf8").digest();
                        secondKeypair = ed.MakeKeypair(secondHash);
                    }

                    try {
                        var transaction = library.base.transaction.create({
                            type: TransactionTypes.LOCK_VOTES,
                            sender: account,
                            keypair: keypair,
                            secondKeypair: secondKeypair,
                            args: body.args || []
                        });
                    } catch (e) {
                        return cb(e.toString());
                    }
                    modules.transactions.receiveTransactions([transaction], cb);
                });
            }
        }, function (err, transaction) {
            if (err) {
                return cb(err.toString());
            }

            return cb(null, { transactionId: transaction[0].id });

            // TODO: for confirmed transaction with block
        })
    })
}

shared.getLockVote = function (req, cb) {
    var query;
    if (req.body && req.body.id) {
        query = req.body;
    } else if (req.params && req.params.id) {
        query = req.params;
    }
    library.scheme.validate(query, {
        type: "object",
        properties: {
            id: {
                type: "string",
                minLength: 1
            }
        },
        required: ["id"]
    }, function (err) {
        if (err) {
            return cb(err[0].toString());
        }

        self.getLockVote(query.id, (err, result) => {
            if (err) {
                return cb(err);
            }

            if (result == null) {
                return cb(null, null);
            }

            const blockHeight = modules.blocks.getLastBlock().height;
            const factor = __private.calcVoteFactor(result.asset, blockHeight);
            // const numOfVotes = __private.calcNumOfVotes(result.asset, blockHeight);
            const numOfVotes = __private.calcNumOfVotesWithFactor(result.asset, factor);

            return cb(null, {
                id: result.id,
                blockId: result.blockId,
                timestamp: result.timestamp,
                senderId: result.senderId,
                asset: {
                    state: result.asset.state,
                    lockAmount: result.asset.lockAmount,
                    currentHeight: result.asset.currentHeight,
                    originHeight: result.asset.originHeight,
                    address: result.asset.address,
                    factor: factor,
                    numOfVotes: numOfVotes
                }
            });
        });
    });
}

shared.getAllLockVotes = function (req, cb) {
    var query = req.body;
    library.scheme.validate(query, {
        type: "object",
        properties: {
            address: {
                type: "string",
                minLength: 1,
                maxLength: 50
            },
            state: {
                type: "integer"
            },
            offset: {
                type: "integer"
            },
            limit: {
                type: "integer"
            },
            orderByHeight: {
                type: "integer"
            },
            orderByAmount: {
                type: "integer"
            }
        },
        required: ["address"]
    }, function (err) {
        if (err) {
            return cb(err[0].toString());
        }

        if (!addressHelper.isBase58CheckAddress(query.address)) {
            return cb("Invalid address");
        }

        let state = null;
        if (query.state != null) {
            state = Number.parseInt(query.state);
            if (!_.isSafeInteger(state)) {
                return cb("Unsupported state format");
            }
            if (state !== 0 && state !== 1) {
                return cb("Invalid state, Must be[0, 1]");
            }
        }

        let offset = _.toSafeInteger(query.offset);
        if (offset < 0) offset = 0;

        let limit = _.toSafeInteger(query.limit);
        if (limit <= 0 || limit > 100) limit = 100;

        const sortHeightDesc = (a, b) => {
            return b.asset.originHeight - a.asset.originHeight;
        };
        const sortHeightAsce = (a, b) => {
            return a.asset.originHeight - b.asset.originHeight;
        };
        const sortAmountDesc = (a, b) => {
            return b.asset.lockAmount - a.asset.lockAmount;
        };
        const sortAmountAsce = (a, b) => {
            return a.asset.lockAmount - b.asset.lockAmount;
        }
        const sortNone = (a, b) => {
            return 0;
        };

        let orderByHeight = _.toSafeInteger(query.orderByHeight);
        if (orderByHeight < -1 || orderByHeight > 1) {
            orderByHeight = 0;
        }
        let heightSorter = sortNone;
        if (orderByHeight == 1) {
            heightSorter = sortHeightAsce;
        } else if (orderByHeight == -1) {
            heightSorter = sortHeightDesc;
        }
        let orderByAmount = _.toSafeInteger(query.orderByAmount);
        if (orderByAmount < -1 || orderByAmount > 1) {
            orderByHeight = 0;
        }
        let amountSorter = sortNone;
        if (orderByAmount == 1) {
            amountSorter = sortAmountAsce;
        } else if (orderByAmount == -1) {
            amountSorter = sortAmountDesc;
        }

        modules.accounts.getAccount({ address: query.address }, function (err, account) {
            if (err) {
                return cb(err.toString());
            }

            if (!account) {
                return cb("Account not found");
            }

            self.listLockVotes({ address: account.address, state: state }, (err, result) => {
                if (err) {
                    return cb(err);
                }
                if (result.count <= 0) {
                    return cb(null, result);
                }

                const blockHeight = modules.blocks.getLastBlock().height;
                const resultTrs = result.trs.map(tr => {
                    const factor = __private.calcVoteFactor(tr.asset, blockHeight);
                    // const numOfVotes = __private.calcNumOfVotes(tr.asset, blockHeight);
                    const numOfVotes = __private.calcNumOfVotesWithFactor(tr.asset, factor);
                    return {
                        id: tr.id,
                        blockId: tr.blockId,
                        timestamp: tr.timestamp,
                        senderId: tr.senderId,
                        asset: {
                            state: tr.asset.state,
                            lockAmount: tr.asset.lockAmount,
                            currentHeight: tr.asset.currentHeight,
                            originHeight: tr.asset.originHeight,
                            address: tr.asset.address,
                            factor: factor,
                            numOfVotes: numOfVotes
                        }
                    };
                });

                resultTrs.sort((a, b) => {
                    let result = heightSorter(a, b);
                    if (result == 0) {
                        result = amountSorter(a, b);
                    }
                    return result;
                });

                const trs = resultTrs.slice(offset, offset + limit);
                return cb(null, { trs: trs, count: result.count })

            });
        });
    });
}

shared.removeLockVote = function (req, cb) {
    var body = req.body;
    library.scheme.validate(body, {
        type: "object",
        properties: {
            secret: {
                type: "string",
                minLength: 1,
                maxLength: 100
            },
            publicKey: {
                type: "string",
                format: "publicKey"
            },
            secondSecret: {
                type: "string",
                minLength: 1
            },
            multisigAccountPublicKey: {
                type: "string",
                format: "publicKey"
            },
            args: {
                type: 'array',
                minLength: 1,
                uniqueItems: true
            }
        },
        required: ["secret"]
    }, function (err) {
        if (err) {
            return cb(err[0].message);
        }

        var hash = crypto.createHash("sha256").update(body.secret, "utf8").digest();
        var keypair = ed.MakeKeypair(hash);

        if (body.publicKey) {
            if (keypair.publicKey.toString("hex") != body.publicKey) {
                return cb("Invalid passphrase");
            }
        }

        library.balancesSequence.add(function (cb) {
            if (body.multisigAccountPublicKey && body.multisigAccountPublicKey != keypair.publicKey.toString("hex")) {
                modules.accounts.getAccount({ publicKey: body.multisigAccountPublicKey }, function (err, account) {
                    if (err) {
                        return cb(err.toString());
                    }

                    if (!account) {
                        return cb("Multisignature account not found");
                    }

                    if (!account.multisignatures) {
                        return cb("Account does not has multisignatures enabled");
                    }

                    if (account.multisignatures.indexOf(keypair.publicKey.toString("hex")) < 0) {
                        return cb("Account does not belong to multisignature group");
                    }

                    modules.accounts.getAccount({ publicKey: keypair.publicKey }, function (err, requester) {
                        if (err) {
                            return cb(err.toString());
                        }

                        if (!requester || !requester.publicKey) {
                            return cb("Invalid requester");
                        }

                        if (requester.secondSignature && !body.secondSecret) {
                            return cb("Invalid second passphrase");
                        }

                        if (requester.publicKey == account.publicKey) {
                            return cb("Invalid requester");
                        }

                        var secondKeypair = null;
                        if (requester.secondSignature) {
                            var secondHash = crypto.createHash("sha256").update(body.secondSecret, "utf8").digest();
                            secondKeypair = ed.MakeKeypair(secondHash);
                        }

                        try {
                            var transaction = library.base.transaction.create({
                                type: TransactionTypes.UNLOCK_VOTES,
                                sender: account,
                                keypair: keypair,
                                secondKeypair: secondKeypair,
                                args: body.args || []
                            });
                        } catch (e) {
                            return cb(e.toString());
                        }

                        modules.transactions.receiveTransactions([transaction], cb);
                    });
                });
            } else {
                modules.accounts.getAccount({ publicKey: keypair.publicKey.toString("hex") }, function (err, account) {
                    if (err) {
                        return cb(err.toString());
                    }

                    if (!account) {
                        return cb("Account not found");
                    }

                    if (account.secondSignature && !body.secondSecret) {
                        return cb("Invalid second passphrase");
                    }

                    var secondKeypair = null;
                    if (account.secondSignature) {
                        var secondHash = crypto.createHash("sha256").update(body.secondSecret).digest();
                        secondKeypair = ed.MakeKeypair(secondHash);
                    }

                    try {
                        var transaction = library.base.transaction.create({
                            type: TransactionTypes.UNLOCK_VOTES,
                            sender: account,
                            keypair: keypair,
                            secondKeypair: secondKeypair,
                            args: body.args || []
                        });
                    } catch (e) {
                        return cb(e.toString());
                    }

                    modules.transactions.receiveTransactions([transaction], cb);
                });
            }
        }, function (err, transaction) {
            if (err) {
                return cb(err.toString());
            }

            return cb(null, { transactionId: transaction[0].id });
        })
    });
}

// Export
module.exports = LockVote