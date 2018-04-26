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

function callMethod(shared, call, args, cb) {
  if (typeof shared[call] !== "function") {
    return cb("Function not found in module: " + call);
  }

  var callArgs = [args, cb];
  shared[call].apply(null, callArgs);
}

module.exports = {
  callMethod: callMethod
};
