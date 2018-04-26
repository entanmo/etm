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

var constants = require('../utils/constants');

module.exports = {
	loadBlocksFromPeer: {
		id: 'blocks.loadBlocksFromPeer',
		type: 'array'
    },
    
	getBlock: {
		id: 'blocks.getBlock',
		type: "object",
        properties: {
        id: {
            type: 'string',
            minLength: 1
        },
        height: {
            type: 'integer',
            minimum: 1
        },
        hash: {
            type: 'string',
            minLength: 1
        }
        },
    },
    
	getBlocks: {
		id: 'blocks.getBlocks',
		type: "object",
        properties: {
            limit: {
                type: "integer",
                minimum: 0,
                maximum: 100
            },
            orderBy: {
                type: "string"
            },
            offset: {
                type: "integer",
                minimum: 0
            },
            generatorPublicKey: {
                type: "string",
                format: "publicKey"
            },
            totalAmount: {
                type: "integer",
                minimum: 0,
                maximum: constants.totalAmount
            },
            totalFee: {
                type: "integer",
                minimum: 0,
                maximum: constants.totalAmount
            },
            reward: {
                type: "integer",
                minimum: 0
            },
            previousBlock: {
                type: "string"
            },
            height: {
                type: "integer"
            }
        }
    },

    getFullBlock: {
        id: 'blocks.getFullBlock',
        type: "object",
        properties: {
            id: {
                type: 'string',
                minLength: 1
            },
            height: {
                type: 'integer',
                minimum: 1
            }
        }
    }
};
