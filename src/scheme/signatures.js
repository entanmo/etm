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
    signature: {
        id: 'signature',
        type: 'object',
        properties: {
          publicKey: {
            type: 'string',
            format: 'publicKey'
          }
        },
        required: ['publicKey']
    },

    addSignature: {
        id: 'signatures.addSignature',
        type: "object",
        properties: {
            secret: {
                type: "string",
                minLength: 1
            },
            secondSecret: {
                type: "string",
                minLength: 1
            },
            publicKey: {
                type: "string",
                format: "publicKey"
            },
            multisigAccountPublicKey: {
                type: "string",
                format: "publicKey"
            }
        },
        required: ["secret", "secondSecret"]
    }
}