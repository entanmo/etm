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

// var sodium = require('sodium').api;
const sodium = require("sodium-native");

module.exports = {
  MakeKeypair: function (hash) {
    // var keypair = sodium.crypto_sign_seed_keypair(hash);
    // return {
    //   publicKey: keypair.publicKey,
    //   privateKey: keypair.secretKey
    // };

    let publicKey = Buffer.alloc(sodium.crypto_sign_PUBLICKEYBYTES);
    let privateKey = Buffer.alloc(sodium.crypto_sign_SECRETKEYBYTES);

    try {
      sodium.crypto_sign_seed_keypair(publicKey, privateKey, hash);
    } catch (err) {
      console.log("makeKaypair:", err);
      return null;
    }

    return {
      publicKey,
      privateKey
    };
  },

  Sign: function (hash, keypair) {
    // return sodium.crypto_sign_detached(hash, Buffer.from(keypair.privateKey, 'hex'));

    let signature = Buffer.alloc(sodium.crypto_sign_BYTES);

    try {
      sodium.crypto_sign_detached(signature, hash, keypair.privateKey);
    } catch (err) {
      console.log("sign:", err);
      return null;
    }

    return signature;
  },

  Verify: function (hash, signatureBuffer, publicKeyBuffer) {
    // return sodium.crypto_sign_verify_detached(signatureBuffer, hash, publicKeyBuffer);
    let result = false;

    try {
      result = sodium.crypto_sign_verify_detached(signatureBuffer, hash, publicKeyBuffer);
    } catch (err) {
      console.log("verify:", err);
      result = undefined;
    }
    return result;
  }
}