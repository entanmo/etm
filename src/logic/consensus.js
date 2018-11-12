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

var assert = require("assert");
var crypto = require("crypto");
var ByteBuffer = require("bytebuffer");
var ed = require('../utils/ed.js');
var ip = require('ip');
var bignum = require('../utils/bignumber');
var slots = require('../utils/slots.js');

const reportor = require("../utils/kafka-reportor");
// const PoW = require('./pow');
let PoW;

function Consensus(scope, cb) {
  this.scope = scope;
  this.pendingBlock = null;
  this.pendingVotes = null;
  this.votesKeySet = {};
  //cb && setImmediate(cb, null, this);
  PoW = require('./pow');
  PoW.onReady(() => {
    cb && setImmediate(cb, null, this);
  });
}

Consensus.prototype.createVotes = function (keypairs, block) {
  var hash = this.getVoteHash(block.height, block.id);
  var votes = {
    height: block.height,
    id: block.id,
    timestamp:block.timestamp,
    signatures: []
  };
  keypairs.forEach(function (el) {
    votes.signatures.push({
      key: el.publicKey.toString('hex'),
      sig: ed.Sign(hash, el).toString('hex')
    });
  });
  return votes;
}

Consensus.prototype.verifyVote = function (height, id, voteItem) {
  try {
    var hash = this.getVoteHash(height, id);
    var signature = new Buffer(voteItem.sig, "hex");
    var publicKey = new Buffer(voteItem.key, "hex");
    return ed.Verify(hash, signature, publicKey);
  } catch (e) {
    return false;
  }
}

Consensus.prototype.getVoteHash = function (height, id) {
  var bytes = new ByteBuffer();
  bytes.writeLong(height);
  if (global.featureSwitch.enableLongId) {
    bytes.writeString(id)
  } else {
    var idBytes = bignum(id).toBuffer({
      size: 8
    });
    for (var i = 0; i < 8; i++) {
      bytes.writeByte(idBytes[i]);
    }
  }
  bytes.flip();
  return crypto.createHash('sha256').update(bytes.toBuffer()).digest();
}

Consensus.prototype.hasEnoughVotes = function (votes) {
  return votes && votes.signatures && votes.signatures.length > slots.delegates * 2 / 3;
}

Consensus.prototype.hasEnoughVotesRemote = function (votes) {
  return votes && votes.signatures && votes.signatures.length >= 6;
}

Consensus.prototype.getPendingBlock = function () {
  return this.pendingBlock;
}

Consensus.prototype.hasPendingBlock = function (timestamp) {
  if (!this.pendingBlock) {
    return false;
  }
  return slots.getSlotNumber(this.pendingBlock.timestamp) == slots.getSlotNumber(timestamp);
}

Consensus.prototype.setPendingBlock = function (block) {
  this.pendingVotes = null;
  this.votesKeySet = {};
  this.pendingBlock = block;
}

Consensus.prototype.clearState = function () {
  this.pendingVotes = null;
  this.votesKeySet = {};
  this.pendingBlock = null;
}

Consensus.prototype.addPendingVotes = function (votes) {
  if (!this.pendingBlock || this.pendingBlock.height != votes.height || this.pendingBlock.id != votes.id) {
    return this.pendingVotes;
  }
  for (var i = 0; i < votes.signatures.length; ++i) {
    var item = votes.signatures[i];
    if (this.votesKeySet[item.key]) {
      continue;
    }
    if (this.verifyVote(votes.height, votes.id, item)) {
      this.votesKeySet[item.key] = true;
      if (!this.pendingVotes) {
        this.pendingVotes = {
          height: votes.height,
          id: votes.id,
          signatures: [],
          timestamp:votes.timestamp
        };
      }
      this.pendingVotes.signatures.push(item);
    }
  }
  return this.pendingVotes;
}

Consensus.prototype.createPropose = function (keypair, block, address, cb) {
  assert(keypair.publicKey.toString("hex") == block.generatorPublicKey);
  var propose = {
    height: block.height,
    id: block.id,
    timestamp: block.timestamp,
    generatorPublicKey: block.generatorPublicKey,
    address: address
  };

  this.pow(propose, (err, pow) => {
    if (err) {
      return cb(err);
    }

    propose.hash = pow.hash;
    propose.signature = ed.Sign(Buffer.from(propose.hash, 'hex'), keypair).toString('hex');
    propose.nonce = pow.nonce;

    cb(null, propose);
  });
}

Consensus.prototype.pow = function (propose, cb) {
  var hash = this.getProposeHash(propose).toString('hex');
  this.getAddressIndex(propose, (err, target) => {
    if (err) {
      reportor.report("PoW", {
        subaction: "index",
        id: propose.id,
        height: propose.height,
        timestamp: propose.timestamp,
        hash: hash,
        error: `get target index error(${err})`
      });
      return cb(err);
    }
    
    const powUptime = reportor.uptime;
    const timer = Date.now();
    function onError(uuid, data) {
      reportor.report("PoW", {
        subaction: "calc",
        id: propose.id,
        height: propose.height,
        timestamp: propose.timestamp,
        hash: hash,
        target: target,
        duration: reportor.uptime - powUptime,
        error: data && data.reason
      });
      global.library.logger.log(`pow - error(${data.reason})`)
      cb(data && data.reason);
    }

    function onPoW(uuid, data) {
      reportor.report("PoW", {
        subaction: "calc",
        id: propose.id,
        height: propose.height,
        timestamp: propose.timestamp,
        hash: hash,
        target: target,
        pow: data.hash,
        nonce: data.nonce,
        duration: reportor.uptime - powUptime
      });
      const duration = Date.now() - timer;
      global.library.logger.log(`pow - success hash(${data.hash}), nonce(${data.nonce}), duration(${duration / 1000.0}sec)`);
      cb(null, {
        hash: data.hash,
        nonce: data.nonce
      });
    }

    function onTimeout(uuid, data) {
      reportor.report("PoW", {
        subaction: "calc",
        id: propose.id,
        height: propose.height,
        timestamp: propose.timestamp,
        hash: hash,
        target: target,
        duration: reportor.uptime - powUptime,
        timeout: data.desc
      });
      global.library.logger.log(`pow - timeout ${data.desc}`);
      cb(new Error('Error: Timeout'));
    }

    PoW.pow(hash, target, slots.powTimeOut * 1000, {
      onError: onError,
      onPoW: onPoW,
      onTimeout: onTimeout
    });
  });
}


Consensus.prototype.getProposeHash = function (propose) {
  var bytes = new ByteBuffer();
  bytes.writeLong(propose.height);

  if (global.featureSwitch.enableLongId) {
    bytes.writeString(propose.id)
  } else {
    var idBytes = bignum(propose.id).toBuffer({
      size: 8
    });
    for (var i = 0; i < 8; i++) {
      bytes.writeByte(idBytes[i]);
    }
  }

  var generatorPublicKeyBuffer = new Buffer(propose.generatorPublicKey, "hex");
  for (var i = 0; i < generatorPublicKeyBuffer.length; i++) {
    bytes.writeByte(generatorPublicKeyBuffer[i]);
  }

  bytes.writeInt(propose.timestamp);

  var parts = propose.address.split(':');
  assert(parts.length == 2);
  bytes.writeInt(ip.toLong(parts[0]));
  bytes.writeInt(Number(parts[1]));

  bytes.flip();
  return crypto.createHash('sha256').update(bytes.toBuffer()).digest();
}

Consensus.prototype.normalizeVotes = function (votes) {
  var report = this.scope.scheme.validate(votes, {
    type: "object",
    properties: {
      height: {
        type: "integer"
      },
      id: {
        type: "string"
      },
      signatures: {
        type: "array",
        minLength: 1,
        maxLength: slots.delegates
      }
    },
    required: ["height", "id", "signatures"]
  });
  if (!report) {
    throw Error(this.scope.scheme.getLastError());
  }
  return votes;
}

Consensus.prototype.acceptPropose = function (propose, cb) {
  this.verifyPOW(propose, (err, ok) => {
    if (err) {
      return setImmediate(cb, err);
    }

    if (!ok) {
      return setImmediate(cb, "Verify porpose powHash failed.");
    }

    try {
      var signature = new Buffer(propose.signature, "hex");
      var publicKey = new Buffer(propose.generatorPublicKey, "hex");
      if (ed.Verify(Buffer.from(propose.hash, 'hex'), signature, publicKey)) {
        return setImmediate(cb);
      } else {
        return setImmediate(cb, "Vefify signature failed");
      }
    } catch (e) {
      return setImmediate(cb, "Verify signature exception: " + e.toString());
    }
  });
}

Consensus.prototype.verifyPOW = function (propose, cb) {
  var hash = this.getProposeHash(propose).toString('hex');
  this.getAddressIndex(propose, (err, target) => {
    if (err) {
      return cb(err);
    }

    var src = hash + propose.nonce.toString();
    var sha256Result = crypto.createHash('sha256').update(src).digest('hex');

    global.library.logger.log(`verifyPoW: ${propose.hash}, ${propose.nonce}`);
    if (sha256Result === propose.hash && sha256Result.indexOf(target) === 0) {
      return cb(null, true);
    }
    return cb(null, false);
  });
}

Consensus.prototype.getAddressIndex = function (propose, cb) {
  global.library.modules['delegates'].getDelegateIndex(propose, function (err, index) {
    if (err) {
      return cb(err);
    }

    if (index < 0) {
      return cb(new Error('Failed to get address index.'));
    }
    index = index % (Math.pow(2, slots.leading) - 1);
    var strIndex = index.toString(2).padStart(slots.leading, '0');
    cb(null, strIndex);
  });
}

module.exports = Consensus;