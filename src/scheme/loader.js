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
    loadBlocks: {
        id: 'loader.loadBlocks',
        type: "object",
        properties: {
            "height": {
            type: "integer",
            minimum: 0
            }
        }, 
        required: ['height']
    },

    loadSignatures: {
        id: 'loader.loadSignatures',
        type: "object",
        properties: {
            signatures: {
                type: "array",
                uniqueItems: true
            }
        },
        required: ['signatures']
    },

    loadUnconfirmedTransactions: {
        id: 'loader.loadUnconfirmedTransactions',
        type: "object",
        properties: {
            transactions: {
                type: "array",
                uniqueItems: true
            }
        },
        required: ['transactions']
    }




}