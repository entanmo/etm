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
  SEND: 0, // ETM TRANSFER
  SIGNATURE: 1, // SETUP SECOND_PASSWORD
  DELEGATE: 2, // SECOND_PASSWORD
  VOTE: 3, // VOTE FOR DELEGATE
  MULTI: 4, // MULTISIGNATURE
  DAPP: 5, // DAPP REGISTER
  IN_TRANSFER: 6, // DAPP DEPOSIT
  OUT_TRANSFER: 7, // DAPP WITHDRAW
  STORAGE: 8, // UPLOAD STORAGE

  // UIA: USER ISSUE ASSET
  UIA_ISSUER: 9, // UIA ISSUER REGISTER
  UIA_ASSET: 10, // UIA ASSET REGISTER
  UIA_FLAGS: 11, // UIA FLAGS UPDATE
  UIA_ACL: 12, // UIA ACL UPDATE
  UIA_ISSUE: 13, // UIA ISSUE
  UIA_TRANSFER: 14, // UIA TRANSFER

  LOCK: 100, // ACCOUNT LOCK
  LOCK_VOTES: 101,  // LOCK FOR VOTE
  UNLOCK_VOTES: 102, // UNLOCK WITHIN VOTE

  DELAY_TRANSFER: 110, // ETM TRANSFER, DELAY ACTION
}