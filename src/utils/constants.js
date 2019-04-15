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

module.exports = {
  maxAmount: 100000000,
  maxPayloadLength: 8 * 1024 * 1024,
  blockHeaderLength: 248,
  addressLength: 208,
  maxAddressesLength: 208 * 128,
  maxClientConnections: 100,
  numberLength: 100000000,
  feeStartVolume: 10000 * 100000000,
  feeStart: 1,
  maxRequests: 10000 * 12,
  requestLength: 104,
  signatureLength: 196,
  maxSignaturesLength: 196 * 256,
  maxConfirmations : 77 * 100,
  confirmationLength: 77,
  fixedPoint : Math.pow(10, 8),
  totalAmount: 10000000000000000,
  maxTxsPerBlock: 600,
  maxTxsCache: 2000
}
