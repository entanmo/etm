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

'use strict';

var crypto = require('crypto');
var util = require('util');
var async = require('async');
var ed = require('../utils/ed.js');
var bignum = require('../utils/bignumber');
var Router = require('../utils/router.js');
var slots = require('../utils/slots.js');
var BlockStatus = require("../utils/block-status.js");
var constants = require('../utils/constants.js');
var TransactionTypes = require('../utils/transaction-types.js');
var sandboxHelper = require('../utils/sandbox.js');
var addressHelper = require('../utils/address.js')
var scheme = require('../scheme/delegates');
var chaos = require('../utils/chaos.js');
const _ = require("lodash");

require('array.prototype.find'); // Old node fix

// Private fields
var modules, library, self, __private = {}, shared = {};

__private.loaded = false;
__private.blockStatus = new BlockStatus();
__private.keypairs = {};
__private.forgingEanbled = true;


function Delegate() {
  this.create = function (data, trs) {
    // trs.recipientId = null;
    // trs.amount = 0;
    trs.recipientId = "A4MFB3MaPd355ug19GYPMSakCAWKbLjDTb";//TODO:零时添加以后换成基金会地址
    trs.amount = 1000 * constants.fixedPoint;
    trs.asset.delegate = {
      username: data.username,
      publicKey: data.sender.publicKey
    };

    if(trs.asset.delegate.username){
      trs.asset.delegate.username=trs.asset.delegate.username.toLowerCase().trim();
    }

    return trs;
  }

  this.calculateFee = function (trs, sender) {
    return 0.1 * constants.fixedPoint;
    // return 100 * constants.fixedPoint;
  }

  this.verify = function (trs, sender, cb) {
    // if (trs.recipientId) {
    //   return setImmediate(cb, "Invalid recipient");
    // }

    // if (trs.amount != 0) {
    //   return setImmediate(cb, "Invalid transaction amount");
    // }

    if (sender.isDelegate > 0) {
      return cb("Account is already a delegate");
    }

    if (!trs.asset || !trs.asset.delegate) {
      return cb("Invalid transaction asset");
    }

    if (!trs.asset.delegate.username) {
      return cb("Username is undefined");
    }

    // if (trs.asset.delegate.username !== trs.asset.delegate.username.toLowerCase()) {
    //   return cb("Username should be lowercase");
    // }

    var allowSymbols = /^[a-z0-9!@$&_.]+$/g;

    var username = String(trs.asset.delegate.username).toLowerCase().trim();

    if (username == "") {
      return cb("Empty username");
    }

    if (username.length > 20) {
      return cb("Username is too long. Maximum is 20 characters");
    }

    if (addressHelper.isAddress(username)) {
      return cb("Username can not be a potential address");
    }

    if (!allowSymbols.test(username)) {
      return cb("Username can only contain alphanumeric characters with the exception of !@$&_.");
    }

    modules.accounts.getAccount({
      username: username
    }, function (err, account) {
      if (err) {
        return cb(err);
      }

      if (account) {
        return cb("Username already exists");
      }

      cb(null, trs);
    });
  }

  this.process = function (trs, sender, cb) {
    setImmediate(cb, null, trs);
  }

  this.getBytes = function (trs) {
    if (!trs.asset.delegate.username) {
      return null;
    }
    try {
      var buf = new Buffer(trs.asset.delegate.username, 'utf8');
    } catch (e) {
      throw Error(e.toString());
    }

    return buf;
  }

  this.apply = function (trs, block, sender, cb) {
    var data = {
      address: sender.address,
      // u_isDelegate: 0,
      isDelegate: 1,
      vote: 0
    }

    if (trs.asset.delegate.username) {
      data.u_username = null;
      data.username = trs.asset.delegate.username;
    }

    modules.accounts.setAccountAndGet(data, (err) => {
      if (err) {
        return cb(err);
      }

      if (block.height !== 1) {
        modules.accounts.loadOrCreate({
          address: trs.recipientId
        }, function (err, recipient) {
          if (err) {
            return cb(err);
          }

          modules.accounts.mergeAccountAndGet({
            address: trs.recipientId,
            balance: trs.amount,
            u_balance: trs.amount,
            blockId: block.id,
            round: modules.round.calc(block.height)
          }, function (err) {
            cb(err);
          });
        });
      } else {
        cb();
      }
    });
  }

  this.undo = function (trs, block, sender, cb) {
    var data = {
      address: sender.address,
      // u_isDelegate: 1,
      isDelegate: 0,
      vote: 0
    }

    if (!sender.nameexist && trs.asset.delegate.username) {
      data.username = null;
      data.u_username = trs.asset.delegate.username;
    }

    modules.accounts.setAccountAndGet(data, (err) => {
      if (err) {
        return cb(err);
      }
      
      if (block.height !== 1) {
        modules.accounts.setAccountAndGet({
          address: trs.recipientId
        }, function (err, recipient) {
          if (err) {
            return cb(err);
          }

          modules.accounts.mergeAccountAndGet({
            address: trs.recipientId,
            balance: -trs.amount,
            u_balance: -trs.amount,
            blockId: block.id,
            round: modules.round.calc(block.height)
          }, function (err) {
            cb(err);
          });
        });
      } else {
        cb();
      }
    });
  }

  this.applyUnconfirmed = function (trs, sender, cb) {
    if (sender.isDelegate > 0) {
      return cb("Account is already a delegate");
    }

    var nameKey = trs.asset.delegate.username + ':' + trs.type
    var idKey = sender.address + ':' + trs.type
    if (library.oneoff.has(nameKey) || library.oneoff.has(idKey)) {
      return setImmediate(cb, 'Double submit')
    }
    library.oneoff.set(nameKey, true)
    library.oneoff.set(idKey, true)
    setImmediate(cb) 
  }

  this.undoUnconfirmed = function (trs, sender, cb) {
    var nameKey = trs.asset.delegate.name + ':' + trs.type
    var idKey = sender.address + ':' + trs.type
    library.oneoff.delete(nameKey)
    library.oneoff.delete(idKey)
    setImmediate(cb)
  }

  this.objectNormalize = function (trs) {
    var report = library.scheme.validate(trs.asset.delegate, /*{
      type: "object",
      properties: {
        publicKey: {
          type: "string",
          format: "publicKey"
        }
      },
      required: ["publicKey"]
    }*/scheme.delegate);

    if (!report) {
      throw Error("Can't verify delegate transaction, incorrect parameters: " + library.scheme.getLastError());
    }

    return trs;
  }

  this.dbRead = function (raw) {
    if (!raw.d_username) {
      return null;
    } else {
      var delegate = {
        username: raw.d_username,
        publicKey: raw.t_senderPublicKey,
        address: raw.t_senderId
      }

      return {delegate: delegate};
    }
  }

  this.dbSave = function (trs, cb) {
    library.dbLite.query("INSERT INTO delegates(username, transactionId, state, senderId) VALUES($username, $transactionId, 1, $senderId)", {
      username: trs.asset.delegate.username,
      transactionId: trs.id,
      senderId: trs.senderId
    }, cb);
  }

  this.ready = function (trs, sender) {
    if (util.isArray(sender.multisignatures) && sender.multisignatures.length) {
      if (!trs.signatures) {
        return false;
      }
      return trs.signatures.length >= sender.multimin - 1;
    } else {
      return true;
    }
  }
}

function UnDelegate() {
  this.create = function (data, trs) {
    trs.recipientId = null;
    trs.amount = 0;
    // trs.asset.delegate = {
    //   publicKey: data.sender.publicKey
    // };

    return trs;
  }

  this.calculateFee = function (trs, sender) {
    return 0.1 * constants.fixedPoint;
  }

  this.verify = function (trs, sender, cb) {
    if (trs.recipientId) {
      return setImmediate(cb, "Invalid recipient");
    }

    if (trs.amount != 0) {
      return setImmediate(cb, "Invalid transaction amount");
    }

    if (sender.isDelegate == 0) {
      return cb("Account is not a delegate");
    }

    if (sender.isDelegate == 2) {
      return cb("Account has cancelled delegate,just wait round change");
    }

    cb(null, trs);
  }

  this.process = function (trs, sender, cb) {
    setImmediate(cb, null, trs);
  }

  this.getBytes = function (trs) {
    return null;
  }

  this.apply = function (trs, block, sender, cb) {
    var data = {
      address: sender.address,
      // u_isDelegate: 1,
      isDelegate: 2,
      // username: null,
      // u_username: sender.username,
      // vote: 0
    }
    modules.accounts.setAccountAndGet(data, cb);
  }

  this.undo = function (trs, block, sender, cb) {
    var data = {
      address: sender.address,
      // u_isDelegate: 2,
      isDelegate: 1,
      // username: sender.u_username,
      // u_username: null,
      // vote: 0
    }

    modules.accounts.setAccountAndGet(data, cb);
  }

  this.applyUnconfirmed = function (trs, sender, cb) {
    if (sender.isDelegate === 0) {
      return cb("Account is not a delegate");
    }
    if (sender.isDelegate === 2) {
      return cb("Account is the process of cancelling delegate");
    }

    var nameKey = trs.id + ':' + trs.type
    var idKey = sender.address + ':' + trs.type
    if (library.oneoff.has(nameKey) || library.oneoff.has(idKey)) {
      return setImmediate(cb, 'Double submit')
    }
    library.oneoff.set(nameKey, true)
    library.oneoff.set(idKey, true)
    setImmediate(cb) 
  }

  this.undoUnconfirmed = function (trs, sender, cb) {
    var nameKey = trs.id + ':' + trs.type
    var idKey = sender.address + ':' + trs.type
    library.oneoff.delete(nameKey)
    library.oneoff.delete(idKey)
    setImmediate(cb)
  }

  this.objectNormalize = function (trs) {
    // var report = library.scheme.validate(trs.asset.delegate, /*{
    //   type: "object",
    //   properties: {
    //     publicKey: {
    //       type: "string",
    //       format: "publicKey"
    //     }
    //   },
    //   required: ["publicKey"]
    // }*/scheme.delegate);

    // if (!report) {
    //   throw Error("Can't verify delegate transaction, incorrect parameters: " + library.scheme.getLastError());
    // }

    return trs;
  }

  this.dbRead = function (raw) {
    // if (!raw.d_username) {
    //   return null;
    // } else {
    //   var delegate = {
    //     username: raw.d_username,
    //     publicKey: raw.t_senderPublicKey,
    //     address: raw.t_senderId
    //   }

    //   return {delegate: delegate};
    // }
    return null;
  }

  this.dbSave = function (trs, cb) {
    console.log(trs)
    library.dbLite.query("UPDATE delegates set state = 0 where (senderId = $senderId and state = 1)", {
      senderId: trs.senderId
    }, cb);
  }

  this.ready = function (trs, sender) {
    if (util.isArray(sender.multisignatures) && sender.multisignatures.length) {
      if (!trs.signatures) {
        return false;
      }
      return trs.signatures.length >= sender.multimin - 1;
    } else {
      return true;
    }
  }
}

// Constructor
function Delegates(cb, scope) {
  library = scope;
  self = this;
  self.__private = __private;
  __private.attachApi();

  library.base.transaction.attachAssetType(TransactionTypes.DELEGATE, new Delegate());
  library.base.transaction.attachAssetType(TransactionTypes.UN_DELEGATE, new UnDelegate());

  setImmediate(cb, null, self);
}

// Private methods
__private.attachApi = function () {
  var router = new Router();

  router.use(function (req, res, next) {
    if (modules && __private.loaded) return next();
    res.status(500).send({success: false, error: "Blockchain is loading"});
  });

  router.map(shared, {
    "get /count": "count",
    "get /voters": "getVoters",
    "get /get": "getDelegate",
    "get /": "getDelegates",
    "get /fee": "getFee",
    "get /forging/getForgedByAccount": "getForgedByAccount",
    "put /": "addDelegate",
    "put /undelegate": "delDelegate",
  });

  if (process.env.DEBUG) {

    router.get('/forging/disableAll', function (req, res) {
      self.disableForging();
      return res.json({success: true});
    });

    router.get('/forging/enableAll', function (req, res) {
      self.enableForging();
      return res.json({success: true});
    });
  }

  router.post('/forging/enable', function (req, res) {
    var body = req.body;
    library.scheme.validate(body, /*{
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
        }
      },
      required: ["secret"]
    }*/ scheme.forgingEnable, function (err) {
      if (err) {
        return res.json({success: false, error: err[0].message});
      }

      var ip = req.connection.remoteAddress;

      if (library.config.forging.access.whiteList.length > 0 && library.config.forging.access.whiteList.indexOf(ip) < 0) {
        return res.json({success: false, error: "Access denied"});
      }

      var keypair = ed.MakeKeypair(crypto.createHash('sha256').update(body.secret, 'utf8').digest());

      if (body.publicKey) {
        if (keypair.publicKey.toString('hex') != body.publicKey) {
          return res.json({success: false, error: "Invalid passphrase"});
        }
      }

      if (__private.keypairs[keypair.publicKey.toString('hex')]) {
        return res.json({success: false, error: "Forging is already enabled"});
      }

      modules.accounts.getAccount({publicKey: keypair.publicKey.toString('hex')}, function (err, account) {
        if (err) {
          return res.json({success: false, error: err.toString()});
        }
        if (account && account.isDelegate > 0) {
          __private.keypairs[keypair.publicKey.toString('hex')] = keypair;
          library.logger.info("Forging enabled on account: " + account.address);
          return res.json({success: true, address: account.address});
        } else {
          return res.json({success: false, error: "Delegate not found"});
        }
      });
    });
  });

  router.post('/forging/disable', function (req, res) {
    var body = req.body;
    library.scheme.validate(body, /*{
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
        }
      },
      required: ["secret"]
    }*/ scheme.forgingDisable, function (err) {
      if (err) {
        return res.json({success: false, error: err[0].message});
      }

      var ip = req.connection.remoteAddress;

      if (library.config.forging.access.whiteList.length > 0 && library.config.forging.access.whiteList.indexOf(ip) < 0) {
        return res.json({success: false, error: "Access denied"});
      }

      var keypair = ed.MakeKeypair(crypto.createHash('sha256').update(body.secret, 'utf8').digest());

      if (body.publicKey) {
        if (keypair.publicKey.toString('hex') != body.publicKey) {
          return res.json({success: false, error: "Invalid passphrase"});
        }
      }

      if (!__private.keypairs[keypair.publicKey.toString('hex')]) {
        return res.json({success: false, error: "Delegate not found"});
      }

      modules.accounts.getAccount({publicKey: keypair.publicKey.toString('hex')}, function (err, account) {
        if (err) {
          return res.json({success: false, error: err.toString()});
        }
        if (account && account.isDelegate > 0) {
          delete __private.keypairs[keypair.publicKey.toString('hex')];
          library.logger.info("Forging disabled on account: " + account.address);
          return res.json({success: true, address: account.address});
        } else {
          return res.json({success: false, error: "Delegate not found"});
        }
      });
    });
  });

  router.get('/forging/status', function (req, res) {
    var query = req.query;
    library.scheme.validate(query, /*{
      type: "object",
      properties: {
        publicKey: {
          type: "string",
          format: "publicKey"
        }
      },
      required: ["publicKey"]
    }*/ scheme.forgingStatus, function (err) {
      if (err) {
        return res.json({success: false, error: err[0].message});
      }

      return res.json({success: true, enabled: !!__private.keypairs[query.publicKey]});
    });
  });

  library.network.app.use('/api/delegates', router);
  library.network.app.use(function (err, req, res, next) {
    if (!err) return next();
    library.logger.error(req.url, err.toString());
    res.status(500).send({success: false, error: err.toString()});
  });
}

__private.getKeysSortByVote = function (cb) {
  modules.accounts.getAccounts({
    isDelegate: { $gt: 0 },
    vote: { $gt: 0 },
    sort: {
      "vote": -1,
      "publicKey": 1
    },
    // limit: slots.delegates
  }, ["publicKey", "vote"], function (err, rows) {
    if (err) {
      cb(err)
    }
    if (!rows || !rows.length) {
      return cb('No active delegates found')
    }
    if (rows.length < slots.delegates) {
      let newRows = [];
      for (let i = 0; i < slots.delegates; i++) {
        newRows[i] = rows[i % rows.length];
      }
      rows = newRows;
    }

    cb(null, rows.map(function (el, index) {
      // return el.publicKey
      el.index = index;
      return el
    }))
  });
}

__private.getBlockSlotData = function (slot, height, cb) {
  __private.getConsensusDelegate(height, slot, (err, selectDelegate) => {
    if (err) {
      return cb(err);
    }

    let delegateKey = selectDelegate.delegateKey;
    if (delegateKey && __private.keypairs[delegateKey]) {
      return cb(null, {
        time: slots.getSlotTime(slot),
        keypair: __private.keypairs[delegateKey]
      });
    }
    cb("not fund delegeteKey in keypairs");
  });
}

__private.loop = function (cb) {
  if (!__private.forgingEanbled) {
    library.logger.trace('Loop:', 'forging disabled');
    return setImmediate(cb);
  }
  if (!Object.keys(__private.keypairs).length) {
    library.logger.trace('Loop:', 'no delegates');
    return setImmediate(cb);
  }

  if (!__private.loaded || modules.loader.syncing() || !modules.round.loaded()|| !modules.peer.isReady()) {
    library.logger.trace('Loop:', 'node not ready');
    return setImmediate(cb);
  }

  var currentSlot = slots.getSlotNumber();
  var lastBlock = modules.blocks.getLastBlock();

  if (currentSlot == slots.getSlotNumber(lastBlock.timestamp)) {
    // library.logger.debug('Loop:', 'lastBlock is in the same slot');
    return setImmediate(cb);
  }
  
  // if (Date.now() % 10000 > 5000) {
  //   library.logger.trace('Loop:', 'maybe too late to collect votes');
  //   return setImmediate(cb);
  // }

  __private.getBlockSlotData(currentSlot, lastBlock.height + 1, function (err, currentBlockData) {
    if (err || currentBlockData === null) {
      library.logger.trace('Loop:', 'skipping slot');
      return setImmediate(cb);
    }
    library.sequence.add(function generateBlock (cb) {
      if (slots.getSlotNumber(currentBlockData.time) == slots.getSlotNumber() && modules.blocks.getLastBlock().timestamp < currentBlockData.time) {
        modules.blocks.generateBlock(currentBlockData.keypair, currentBlockData.time, cb);
      } else {
        // library.logger.log('Loop', 'exit: ' + _activeDelegates[slots.getSlotNumber() % slots.delegates] + ' delegate slot');
        return setImmediate(cb);
      }
    }, function (err) {
      if (err) {
        library.logger.error("Failed generate block within slot:", err);
      }
      return setImmediate(cb);
    });
  });
}

__private.loadMyDelegates = function (cb) {
  var secrets = null;
  if (library.config.forging.secret) {
    secrets = util.isArray(library.config.forging.secret) ? library.config.forging.secret : [library.config.forging.secret];
  }

  async.eachSeries(secrets, function (secret, cb) {
    var keypair = ed.MakeKeypair(crypto.createHash('sha256').update(secret, 'utf8').digest());

    modules.accounts.getAccount({
      publicKey: keypair.publicKey.toString('hex')
    }, function (err, account) {
      if (err) {
        return cb(err);
      }

      if (!account) {
        return cb("Account " + keypair.publicKey.toString('hex') + " not found");
      }

      if (account.isDelegate > 0) {
        __private.keypairs[keypair.publicKey.toString('hex')] = keypair;
        library.logger.info("Forging enabled on account: " + account.address);
      } else {
        library.logger.info("Delegate with this public key not found: " + keypair.publicKey.toString('hex'));
      }
      cb();
    });
  }, cb);
}

__private.getConsensusDelegate = function (height, slot, cb) {
  self.generateDelegateList(height, function (err, activeDelegates) {
    if (err) {
      return cb(err);
    }

    var prevHeight = height > 2 ? height - 2 : height - 1;
    modules.blocks.getBlock({
      'height': prevHeight
    }, function (err, res) {
      if (err) {
        return cb('Get getBlock from last block height error:' + err);
      }

      var lastBlockId = res.block.id;
      var currentSlot = slot;
      var index = __private._getDelegeteIndex(lastBlockId, currentSlot, activeDelegates.length);
      var index2 = index;
      let delegatesByRound = modules.round.getRoundUsedDelegates(height);
      if(delegatesByRound && delegatesByRound.length > 0){
        index = __private.getNoCheatIndex(index,activeDelegates, delegatesByRound);
      }
      
      let delegateKey = activeDelegates[index];
      cb(null, {
        index,
        index2,
        delegateKey,
        activeDelegates
      });
    });
  });
}

__private.getNoCheatIndex = function (index, activeDelegates, delegatesByRound) {
  // 防止理论上超大算力作弊，控制一轮中出块的数量超过5个，超过则取下一个index
  let delegateKey = activeDelegates[index];
  let countProduced = delegatesByRound.filter((temp)=>{
    return temp === delegateKey;
  });

  if (countProduced.length < 5) {
    return index;
  } else {
    return __private.getNoCheatIndex((index + 1) % activeDelegates.length, activeDelegates, delegatesByRound);
  }
}

__private._getDelegeteIndex = function (lastBlockId, slot, limit) {
  let hash = crypto.createHash('sha256').update(lastBlockId).digest('hex');
  let index = chaos(hash, slot, limit);
  return index;
}

__private._getRandomDelegateList = function (randomDelegateList, truncDelegateList, cb) {
  var totalVotes = 0;
  var countVotes = 0;
  var randomIndex = 0;
  for (var i = 0; i < truncDelegateList.length; i++) {
    totalVotes += truncDelegateList[i].vote;
  }

  let hash = crypto.createHash('sha256').update("entanmo").digest('hex');
  var randomNum = chaos(hash, truncDelegateList.length, totalVotes);
   

  for (var k = 0; k < truncDelegateList.length; k++) {
    countVotes += truncDelegateList[k].vote;
    if (countVotes > randomNum) {
      randomIndex = k;
      var randomDelegate = truncDelegateList[k];
      randomDelegate.index = truncDelegateList[k].index;
      randomDelegateList.push(randomDelegate);
      break;
    }
  }


  if (randomDelegateList.length < slots.delegates) {
   
    truncDelegateList.splice(randomIndex, 1);
    __private._getRandomDelegateList(randomDelegateList, truncDelegateList, cb);
  }
  else {
    randomDelegateList.sort(function (a, b) {
      return a.index - b.index;
    })
    cb(randomDelegateList);
  }
}

// Public methods
Delegates.prototype.getActiveDelegateKeypairs = function (height, cb) {
  self.generateDelegateList(height, function (err, delegates) {
    if (err) {
      return cb(err);
    }
    var results = [];
    for (var key in __private.keypairs) {
      if (delegates.indexOf(key) !== -1) {
        results.push(__private.keypairs[key]);
      }
    }
    cb(null, results);
  });
}

Delegates.prototype.validateProposeSlot = function (propose, cb) {
  let slot = slots.getSlotNumber(propose.timestamp);
  __private.getConsensusDelegate(propose.height, slot, (err, selectDelegate) => {
    if (err) {
      return cb(err);
    }

    let delegateKey = selectDelegate.delegateKey;
    if (delegateKey && propose.generatorPublicKey == delegateKey) {
      return cb();
    }
    
    cb("Failed to validate propose slot");
  });
}
//get Delegate index
Delegates.prototype.getDelegateIndex = function (propose ,cb) {
  let slot = slots.getSlotNumber(propose.timestamp);
  __private.getConsensusDelegate(propose.height, slot, (err, selectDelegate) => {
    if (err) {
      return cb(err);
    }

    let delegateKey = selectDelegate.delegateKey;
    if (delegateKey && propose.generatorPublicKey == delegateKey) {
      return cb(null, selectDelegate.index);
    }
    cb("Failed to get delegete index");
  });
}

Delegates.prototype.getMissedDelegates = function (height, slotDiff, cb) {
  let slotArr = [];
  for (let i = slotDiff.start + 1; i < slotDiff.end; i++) {
    slotArr.push(i);
  }

  let missedDelegates = [];
  async.eachSeries(slotArr, (slot, cb) => {
    __private.getConsensusDelegate(height, slot, (err, selectDelegate) => {
      if (err) {
        return cb(err);
      }

      let delegateKey = selectDelegate.delegateKey;
      missedDelegates.push(delegateKey);
      cb();
    });
  }, (err) => {
    setImmediate(cb, err, missedDelegates);
  });
}

Delegates.prototype.generateDelegateList = function (height, cb) {
  __private.getKeysSortByVote(function (err, truncDelegateList) {
    if (err) {
      return cb(err);
    }
    // var seedSource = modules.round.calc(height).toString();
    // var currentSeed = crypto.createHash('sha256').update(seedSource, 'utf8').digest();
    // for (var i = 0, delCount = truncDelegateList.length; i < delCount; i++) {
    //   for (var x = 0; x < 4 && i < delCount; i++, x++) {
    //     var newIndex = currentSeed[x] % delCount;
    //     var b = truncDelegateList[newIndex];
    //     truncDelegateList[newIndex] = truncDelegateList[i];
    //     truncDelegateList[i] = b;
    //   }
    //   currentSeed = crypto.createHash('sha256').update(currentSeed).digest();
    // }
    // cb(null, truncDelegateList);

    __private._getRandomDelegateList([],truncDelegateList,function(delegateList){
      cb(null, delegateList.map(function (el) {
        return el.publicKey
      }));
    })
  });

}

Delegates.prototype.checkDelegates = function (publicKey, votes, cb) {
  if (util.isArray(votes)) {
    modules.accounts.getAccount({publicKey: publicKey}, function (err, account) {
      if (err) {
        return cb(err);
      }
      if (!account) {
        return cb("Account not found");
      }

      modules.lockvote.listLockVotes({address: account.address, state: 1}, (err, result) => {
        if (err) {
          return cb(err);
        }
        if (result.count <= 0) {
          return cb(new Error("Must Lock position for votes"));
        }
        var existing_votes = account.delegates ? account.delegates.length : 0;
        var additions = 0, removals = 0;

        async.eachSeries(votes, function (action, cb) {
          var math = action[0];

          if (math !== '+' && math !== '-') {
            return cb("Invalid math operator");
          }

          async.waterfall([
            function(next){
              if (math == '+') {
                additions += 1;
                next();
              } else if (math == '-') {
                removals += 1;
      
                // 撤销投票时投票系数减半
                // let bHeight = modules.blocks.getLastBlock().height + 1;
                // modules.lockvote.updateLockVotes(account.address, bHeight, 0.5, function (err) {
                //   if (err) {
                //     return next(err);
                //   }
                //   next();
                // });
                next();
              }
            },
            function(next){
              if (additions > 1 || removals > 1) {
                return next("Invalid vote count > 1");
              }
      
              var publicKey = action.slice(1);
      
              try {
                new Buffer(publicKey, "hex");
              } catch (e) {
                return next("Invalid public key");
              }
      
              if (math == "+" && (account.delegates !== null && account.delegates.indexOf(publicKey) != -1)) {
                return next("Failed to add vote, account has already voted for this delegate");
              }
              if (math == "-" && (account.delegates === null || account.delegates.indexOf(publicKey) === -1)) {
                return next("Failed to remove vote, account has not voted for this delegate");
              }
      
              modules.accounts.getAccount({publicKey: publicKey, isDelegate: { $gt: 0 }}, function (err, account) {
                if (err) {
                  return next(err);
                }
      
                if (!account) {
                  return next("Delegate not found");
                }
      
                next();
              });
            }
          ],function(err){
            if (err) {
              return cb(err);
            }
            cb();
          });

        }, function(err) {
          if (err) {
            return cb(err);
          }
          var total_votes = (existing_votes + additions) - removals;
          if (total_votes > 1) {
            return cb("Number of votes  (" + total_votes + " > 1).");
          } else {
            return cb();
          }
        });
      });
    });
  } else {
    setImmediate(cb, "Please provide an array of votes");
  }
}

Delegates.prototype.updateDelegateVotes = function (publicKey, votes, cb) {
  if (util.isArray(votes)) {
    modules.accounts.getAccount({publicKey: publicKey}, function (err, account) {
      if (err) {
        return cb(err);
      }
      if (!account) {
        return cb("Account not found");
      }
      async.eachSeries(votes, function (action, cb) {
        var math = action[0];

        if (math !== '+' && math !== '-') {
          return cb("Invalid math operator");
        }

        if(math == '-'){
          // 撤销投票时投票系数减半
          let bHeight = modules.blocks.getLastBlock().height + 1;
          modules.lockvote.updateLockVotes(account.address, bHeight, 0.5, function (err) {
            return cb(err);
          });
        }
        else{
          cb();
        }
      }, function(err) {
        return cb(err);
      })
    });
  } else {
    setImmediate(cb, "Please provide an array of votes");
  }
}

Delegates.prototype.checkUnconfirmedDelegates = function (publicKey, votes, cb) {
  if (util.isArray(votes)) {
    modules.accounts.getAccount({publicKey: publicKey}, function (err, account) {
      if (err) {
        return cb(err);
      }
      if (!account) {
        return cb("Account not found");
      }

      async.eachSeries(votes, function (action, cb) {
        var math = action[0];

        if (math !== '+' && math !== '-') {
          return cb("Invalid math operator");
        }

        var publicKey = action.slice(1);


        try {
          new Buffer(publicKey, "hex");
        } catch (e) {
          return cb("Invalid public key");
        }

        if (math == "+" && (account.u_delegates !== null && account.u_delegates.indexOf(publicKey) != -1)) {
          return cb("Failed to add vote, account has already voted for this delegate");
        }
        if (math == "-" && (account.u_delegates === null || account.u_delegates.indexOf(publicKey) === -1)) {
          return cb("Failed to remove vote, account has not voted for this delegate");
        }

        modules.accounts.getAccount({publicKey: publicKey, isDelegate: { $gt: 0 }}, function (err, account) {
          if (err) {
            return cb(err);
          }

          if (!account) {
            return cb("Delegate not found");
          }

          cb();
        });
      }, cb)
    });
  } else {
    return setImmediate(cb, "Please provide an array of votes");
  }
}

Delegates.prototype.fork = function (block, cause) {
  library.logger.info('Fork', {
    delegate: block.generatorPublicKey,
    block: {id: block.id, timestamp: block.timestamp, height: block.height, previousBlock: block.previousBlock},
    cause: cause
  });
  library.dbLite.query("INSERT INTO forks_stat (delegatePublicKey, blockTimestamp, blockId, blockHeight, previousBlock, cause) " +
    "VALUES ($delegatePublicKey, $blockTimestamp, $blockId, $blockHeight, $previousBlock, $cause);", {
    delegatePublicKey: block.generatorPublicKey,
    blockTimestamp: block.timestamp,
    blockId: block.id,
    blockHeight: block.height,
    previousBlock: block.previousBlock,
    cause: cause
  });
}

Delegates.prototype.validateBlockSlot = function (block, cb) {
  let slot = slots.getSlotNumber(block.timestamp);
  __private.getConsensusDelegate(block.height, slot, (err, selectDelegate) => {
    if (err) {
      return cb(err);
    }

    let delegateKey = selectDelegate.delegateKey;
    if (delegateKey && block.generatorPublicKey == delegateKey) {
      return cb();
    }
    console.log("##############################################",block,selectDelegate);
    cb("Failed to verify slot, expected delegate: " + delegateKey);
  });
}

Delegates.prototype.getDelegates = function (query, cb) {
  if (!query) {
    throw "Missing query argument";
  }
  modules.accounts.getAccounts({
    isDelegate: { $gt: 0 },
    sort: { "vote": -1, "publicKey": 1 }
  }, ["username", "address", "publicKey", "vote", "missedblocks", "producedblocks", "fees", "rewards", "balance","isDelegate"], function (err, delegates) {
    if (err) {
      return cb(err);
    }

    var limit = query.limit || slots.delegates;
		var offset = query.offset || 0;
		var orderField = query.orderBy || 'rate:asc';

    orderField = orderField ? orderField.split(':') : null;
    limit = limit > slots.delegates ? slots.delegates : limit;

    var orderBy = orderField ? orderField[0] : null;
    var sortMode = orderField && orderField.length == 2 ? orderField[1] : 'asc';

    var count = delegates.length;
    var length = Math.min(limit, count);
    var realLimit = Math.min(offset + limit, count);

    var lastBlock = modules.blocks.getLastBlock();
    var totalSupply = __private.blockStatus.calcSupply(lastBlock.height);
    
    let totalVotes = 0;
    for (var i = 0; i < delegates.length; i++) {
      totalVotes += delegates[i].vote;
    }

    for (var i = 0; i < delegates.length; i++) {
      delegates[i].rate = i + 1;
      totalVotes = totalVotes > 0 ? totalVotes : totalSupply;
      delegates[i].approval = (delegates[i].vote / totalVotes) * 100;
      delegates[i].approval = Math.round(delegates[i].approval * 1e2) / 1e2;

      var percent = 100 - (delegates[i].missedblocks / ((delegates[i].producedblocks + delegates[i].missedblocks) / 100));
      percent = Math.abs(percent) || 0;

      // var outsider = i + 1 > slots.delegates;
      // delegates[i].productivity = (!outsider) ? Math.round(percent * 1e2) / 1e2 : 0;
      delegates[i].productivity = Math.round(percent * 1e2) / 1e2;
      
      delegates[i].forged = bignum(delegates[i].fees).plus(bignum(delegates[i].rewards)).toString();
    }

    return cb(null, {
      delegates: delegates,
      sortMode: sortMode,
      orderBy: orderBy,
      count: count,
      offset: offset,
      limit: realLimit
    });
  });
}

Delegates.prototype.sandboxApi = function (call, args, cb) {
  sandboxHelper.callMethod(shared, call, args, cb);
}

Delegates.prototype.enableForging = function () {
  __private.forgingEanbled = true;
}

Delegates.prototype.disableForging = function () {
  __private.forgingEanbled = false;
}

Delegates.prototype.isDelegatesContainKeypairs = function (round,cb) {
  self.generateDelegateList(round * slots.roundBlocks + 1, function(err,list){
    if(!err){
      let keypairsSet = new Set(Object.keys(__private.keypairs));
      let intersection = Array.from(new Set(list.filter(v => keypairsSet.has(v))));
      if(intersection.length > 0){
        console.log("++++++++++++++++++++++++++++++ intersection",intersection)
        return cb(null,true);
      }
      else{
        return cb(null,false);
      }
    }
    return cb("get list error");
  })
}

Delegates.prototype.getDelegateVoters = function (publicKey,cb) {
  library.dbLite.query("select GROUP_CONCAT(accountId) from mem_accounts2delegates where dependentId = $publicKey", {
    publicKey: publicKey
  }, ['accountId'], function (err, rows) {
    if (err) {
      library.logger.error(err);
      return cb("Database error");
    }
    
    if (!_.isArray(rows) || rows.length <= 0 ||  rows[0].accountId == null) {
      return cb(null, {accounts: []});
    }

    var addresses = rows[0].accountId.split(',');

    modules.accounts.getAccounts({
      address: {$in: addresses},
      sort: 'balance'
    }, ['address', 'balance', 'publicKey', 'username'], function (err, rows) {
      if (err) {
        library.logger.error(err);
        return cb("Database error");
      }
      var lastBlock = modules.blocks.getLastBlock();
      /*
      var totalSupply = __private.blockStatus.calcSupply(lastBlock.height || 1);
      rows.forEach(function (row) {
        row.weight = row.balance / totalSupply * 100;
      });
      return cb(null, {accounts: rows});
      */
      let totalVotes = 0;
      const votes = [];
      async.eachOf(rows, (voter, index, callback) => {
        modules.lockvote.calcLockVotes(voter.address, lastBlock.height, (err, result) => {
          const val = err ? 0 : result;
          votes[index] = val;
          totalVotes += val;
          callback();
        });
      }, err => {
        if (err) {
          return cb(err.toString());
        }
        
        rows.forEach((row, index) => {
          totalVotes = 0;
          if(totalVotes === 0){
            row.weight = 100/rows.length;
          }
          else{
            row.weight = votes[index] / totalVotes * 100;
          }
        });
        return cb(null, {accounts: rows});
      });
    });
  });
}

// Events
Delegates.prototype.onBind = function (scope) {
  modules = scope;
}

Delegates.prototype.onBlockchainReady = function () {
  __private.loaded = true;

  __private.loadMyDelegates(function nextLoop(err) {
    if (err) {
      library.logger.error("Failed to load delegates", err);
    }

    __private.loop(function () {
      setTimeout(nextLoop, 100);
    });

  });
}

Delegates.prototype.cleanup = function (cb) {
  __private.loaded = false;
  cb();
}

// Shared
shared.getDelegate = function (req, cb) {
  var query = req.body;
  library.scheme.validate(query, /*{
    type: "object",
    properties: {
      transactionId: {
        type: "string"
      },
      publicKey: {
        type: "string"
      },
      username: {
        type: "string"
      }
    }
  }*/ scheme.getDelegate, function (err) {
    if (err) {
      return cb(err[0].message);
    }

    modules.delegates.getDelegates(query, function (err, result) {
			if (err) {
				return cb(err);
			}

			var delegate = result.delegates.find(function (delegate) {
				if (query.publicKey) {
					return delegate.publicKey == query.publicKey;
				}
				if (query.username) {
					return delegate.username == query.username;
				}

				return false;
			});

			if (delegate) {
				cb(null, {delegate: delegate});
			} else {
				cb("Delegate not found");
			}
		});
  });
}

shared.count = function(req, cb) {
  library.dbLite.query("select count(*) from delegates where state > 0", {"count": Number}, function(err, rows) {
    if (err) {
      return cb("Failed to count delegates");
    } else {
      return cb(null, { count: rows[0].count });
    }
  });
}

shared.getVoters = function (req, cb) {
  var query = req.body;
  library.scheme.validate(query, /*{
    type: 'object',
    properties: {
      publicKey: {
        type: "string",
        format: "publicKey"
      }
    },
    required: ['publicKey']
  }*/ scheme.getVoters, function (err) {
    if (err) {
      return cb(err[0].message);
    }

    self.getDelegateVoters(query.publicKey,cb);

    // library.dbLite.query("select GROUP_CONCAT(accountId) from mem_accounts2delegates where dependentId = $publicKey", {
    //   publicKey: query.publicKey
    // }, ['accountId'], function (err, rows) {
    //   if (err) {
    //     library.logger.error(err);
    //     return cb("Database error");
    //   }

    //   var addresses = rows[0].accountId.split(',');

    //   modules.accounts.getAccounts({
    //     address: {$in: addresses},
    //     sort: 'balance'
    //   }, ['address', 'balance', 'publicKey', 'username'], function (err, rows) {
    //     if (err) {
    //       library.logger.error(err);
    //       return cb("Database error");
    //     }
    //     var lastBlock = modules.blocks.getLastBlock();
    //     var totalSupply = __private.blockStatus.calcSupply(lastBlock.height);
    //     rows.forEach(function (row) {
    //       row.weight = row.balance / totalSupply * 100;
    //     });
    //     return cb(null, {accounts: rows});
    //   });
    // });
  });
}

shared.getDelegates = function (req, cb) {
  var query = req.body;
  library.scheme.validate(query, /*{
    type: 'object',
    properties: {
      address: {
        type: "string",
        minLength: 1
      },
      limit: {
        type: "integer",
        minimum: 0,
        maximum: slots.delegates
      },
      offset: {
        type: "integer",
        minimum: 0
      },
      orderBy: {
        type: "string"
      }
    }
  }*/ scheme.getDelegates, function (err) {
    if (err) {
      return cb(err[0].message);
    }

    modules.delegates.getDelegates(query, function (err, result) {
      if (err) {
        return cb(err);
      }
      function compareNumber(a, b) {
        var sorta = parseFloat(a[result.orderBy]);
        var sortb = parseFloat(b[result.orderBy]);
        if (result.sortMode == 'asc') {
          return sorta - sortb;
        } else {
          return sortb - sorta;
        }
      };

      function compareString(a, b) {
        var sorta = a[result.orderBy];
        var sortb = b[result.orderBy];
        if (result.sortMode == 'asc') {
          return sorta.localeCompare(sortb);
        } else {
          return sortb.localeCompare(sorta);
        }
      };

      if (result.delegates.length > 0 && typeof result.delegates[0][result.orderBy] == 'undefined') {
        result.orderBy = 'rate';
      }

      if (["approval", "productivity", "rate", "vote", "missedblocks", "producedblocks", "fees", "rewards", "balance"].indexOf(result.orderBy) > - 1) {
        result.delegates = result.delegates.sort(compareNumber);
      } else {
        result.delegates = result.delegates.sort(compareString);
      }

      var delegates = result.delegates.slice(result.offset, result.limit);

      if (!query.address) {
        return cb(null, { delegates: delegates, totalCount: result.count });
      }
      modules.accounts.getAccount({ address: query.address }, function (err, voter) {
        if (err) {
          return cb("Failed to get voter account");
        }
        if (voter && voter.delegates) {
          delegates.map(function (item) {
            item.voted = (voter.delegates.indexOf(item.publicKey) != -1);
          });
        }
        return cb(null, { delegates: delegates, totalCount: result.count });
      });
    });
  });
}

shared.getFee = function (req, cb) {
  var query = req.body;
  var fee = null;

  fee = 0.1 * constants.fixedPoint;

  cb(null, {fee: fee})
}

shared.getForgedByAccount = function (req, cb) {
  var query = req.body;
  library.scheme.validate(query, /*{
    type: "object",
    properties: {
      generatorPublicKey: {
        type: "string",
        format: "publicKey"
      }
    },
    required: ["generatorPublicKey"]
  }*/ scheme.getForgedByAccount, function (err) {
    if (err) {
      return cb(err[0].message);
    }

    modules.accounts.getAccount({publicKey: query.generatorPublicKey}, ["fees", "rewards"], function (err, account) {
      if (err || !account) {
        return cb(err || "Account not found")
      }
      cb(null, {fees: account.fees, rewards: account.rewards, forged: account.fees + account.rewards});
    });
  });
}

shared.addDelegate = function (req, cb) {
  var body = req.body;
  library.scheme.validate(body, /*{
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
        minLength: 1,
        maxLength: 100
      },
      username: {
        type: "string"
      }
    },
    required: ["secret"]
  }*/ scheme.addDelegate, function (err) {
    if (err) {
      return cb(err[0].message);
    }

    var hash = crypto.createHash('sha256').update(body.secret, 'utf8').digest();
    var keypair = ed.MakeKeypair(hash);

    if (body.publicKey) {
      if (keypair.publicKey.toString('hex') != body.publicKey) {
        return cb("Invalid passphrase");
      }
    }

    library.balancesSequence.add(function (cb) {
      if (body.multisigAccountPublicKey && body.multisigAccountPublicKey != keypair.publicKey.toString('hex')) {
        modules.accounts.getAccount({publicKey: body.multisigAccountPublicKey}, function (err, account) {
          if (err) {
            return cb(err.toString());
          }

          if (!account) {
            return cb("Multisignature account not found");
          }

          if (!account.multisignatures || !account.multisignatures) {
            return cb("Account does not have multisignatures enabled");
          }

          if (account.multisignatures.indexOf(keypair.publicKey.toString('hex')) < 0) {
            return cb("Account does not belong to multisignature group");
          }

          modules.accounts.getAccount({publicKey: keypair.publicKey}, function (err, requester) {
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
              return cb("Incorrect requester");
            }

            var secondKeypair = null;

            if (requester.secondSignature) {
              var secondHash = crypto.createHash('sha256').update(body.secondSecret, 'utf8').digest();
              secondKeypair = ed.MakeKeypair(secondHash);
            }

            try {
              var transaction = library.base.transaction.create({
                type: TransactionTypes.DELEGATE,
                username: body.username,
                sender: account,
                keypair: keypair,
                secondKeypair: secondKeypair,
                requester: keypair
              });
            } catch (e) {
              return cb(e.toString());
            }
            modules.transactions.receiveTransactions([transaction], cb);
          });
        });
      } else {
        modules.accounts.getAccount({publicKey: keypair.publicKey.toString('hex')}, function (err, account) {
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
            var secondHash = crypto.createHash('sha256').update(body.secondSecret, 'utf8').digest();
            secondKeypair = ed.MakeKeypair(secondHash);
          }

          try {
            var transaction = library.base.transaction.create({
              type: TransactionTypes.DELEGATE,
              username: body.username,
              sender: account,
              keypair: keypair,
              secondKeypair: secondKeypair
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

      cb(null, {transaction: transaction[0]});
    });
  });
}

shared.delDelegate = function (req, cb) {
  var body = req.body;
  library.scheme.validate(body, scheme.delDelegate, function (err) {
    if (err) {
      return cb(err[0].message);
    }

    var hash = crypto.createHash('sha256').update(body.secret, 'utf8').digest();
    var keypair = ed.MakeKeypair(hash);

    if (body.publicKey) {
      if (keypair.publicKey.toString('hex') != body.publicKey) {
        return cb("Invalid passphrase");
      }
    }

    library.balancesSequence.add(function (cb) {
      if (body.multisigAccountPublicKey && body.multisigAccountPublicKey != keypair.publicKey.toString('hex')) {
        modules.accounts.getAccount({publicKey: body.multisigAccountPublicKey}, function (err, account) {
          if (err) {
            return cb(err.toString());
          }

          if (!account) {
            return cb("Multisignature account not found");
          }

          if (!account.multisignatures || !account.multisignatures) {
            return cb("Account does not have multisignatures enabled");
          }

          if (account.multisignatures.indexOf(keypair.publicKey.toString('hex')) < 0) {
            return cb("Account does not belong to multisignature group");
          }

          modules.accounts.getAccount({publicKey: keypair.publicKey}, function (err, requester) {
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
              return cb("Incorrect requester");
            }

            var secondKeypair = null;

            if (requester.secondSignature) {
              var secondHash = crypto.createHash('sha256').update(body.secondSecret, 'utf8').digest();
              secondKeypair = ed.MakeKeypair(secondHash);
            }

            try {
              var transaction = library.base.transaction.create({
                type: TransactionTypes.UN_DELEGATE,
                sender: account,
                keypair: keypair,
                secondKeypair: secondKeypair,
                requester: keypair
              });
            } catch (e) {
              return cb(e.toString());
            }
            modules.transactions.receiveTransactions([transaction], cb);
          });
        });
      } else {
        modules.accounts.getAccount({publicKey: keypair.publicKey.toString('hex')}, function (err, account) {
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
            var secondHash = crypto.createHash('sha256').update(body.secondSecret, 'utf8').digest();
            secondKeypair = ed.MakeKeypair(secondHash);
          }

          try {
            var transaction = library.base.transaction.create({
              type: TransactionTypes.UN_DELEGATE,
              sender: account,
              keypair: keypair,
              secondKeypair: secondKeypair
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

      cb(null, {transaction: transaction[0]});
    });
  });
}


// Export
module.exports = Delegates;
