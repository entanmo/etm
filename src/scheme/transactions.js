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
    storage: {
        id: 'storage',
        type: "object",
        properties: {
            content: {
            type: "string",
            format: "hex"
            }
        },
        required: ['content']
    },

    getTransactions: {
        id: 'transactions.getTransactions',
        type: "object",
        properties: {
            blockId: {
                type: "string"
            },
            limit: {
                type: "integer",
                minimum: 0,
                maximum: 100
            },
            type: {
                type: "integer",
                minimum: 0,
                maximum: 1000
            },
            orderBy: {
                type: "string"
            },
            offset: {
                type: "integer",
                minimum: 0
            },
            senderPublicKey: {
                type: "string",
                format: "publicKey"
            },
            ownerPublicKey: {
                type: "string",
                format: "publicKey"
            },
            ownerAddress: {
                type: "string"
            },
            senderId: {
                type: "string"
            },
            recipientId: {
                type: "string"
            },
            amount: {
                type: "integer",
                minimum: 0,
                maximum: constants.fixedPoint
            },
            fee: {
                type: "integer",
                minimum: 0,
                maximum: constants.fixedPoint
            },
            uia: {
                type: "integer",
                minimum: 0,
                maximum: 1
            },
            currency: {
                type: "string",
                minimum: 1,
                maximum: 22
            },
            and:{
                type:"integer",
                minimum: 0,
                maximum: 1
            }
        }
    },

    getTransaction: {
        id: 'transactions.getTransaction',
        type: 'object',
        properties: {
            id: {
                type: 'string',
                minLength: 1
            }
        },
        required: ['id']
    },

    getUnconfirmedTransaction: {
        id: 'transactions.getUnconfirmedTransaction',
        type: 'object',
        properties: {
            id: {
                type: 'string',
                minLength: 1,
                maxLength: 64
            }
        },
        required: ['id']
    },

    getUnconfirmedTransactions: {
        id: 'transactions.getUnconfirmedTransactions',
        type: "object",
        properties: {
            senderPublicKey: {
                type: "string",
                format: "publicKey"
            },
            address: {
                type: "string"
            }
        }
    },

    addTransactions: {
        id: 'transactions.addTransactions',
        type: "object",
        properties: {
            secret: {
                type: "string",
                minLength: 1,
                maxLength: 100
            },
            amount: {
                type: "integer",
                minimum: 1,
                maximum: constants.totalAmount
            },
            recipientId: {
                type: "string",
                minLength: 1
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
            multisigAccountPublicKey: {
                type: "string",
                format: "publicKey"
            },
            message: {
                type: "string",
                maxLength: 256
            }
        },
        required: ["secret", "amount", "recipientId"]
    },

    addDelayTransactions: {
        id: 'transactions.addDelayTransactions',
        type: "object",
        properties: {
            secret: {
                type: "string",
                minLength: 1,
                maxLength: 100
            },
            amount: {
                type: "integer",
                minimum: 1,
                maximum: constants.totalAmount
            },
            recipientId: {
                type: "string",
                minLength: 1
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
            multisigAccountPublicKey: {
                type: "string",
                format: "publicKey"
            },
            message: {
                type: "string",
                maxLength: 256
            },
            args: {
                type: 'array',
                minLength: 1,
                maxLength: 1,
                uniqueItems: true
            }
        },
        required: ["secret", "amount", "recipientId", "args"]
    },

    putStorage: {
        id: 'transactions.putStorage',
        type: "object",
        properties: {
            secret: {
                type: "string",
                minLength: 1,
                maxLength: 100
            },
            secondSecret: {
                type: "string",
                minLength: 1,
                maxLength: 100
            },
            multisigAccountPublicKey: {
                type: "string",
                format: "publicKey"
            },
            content: {
                type: "string",
                minLength: 1,
                maxLength: 4096,
            },
            encode: {
                type: "string",
                minLength: 1,
                maxLength: 10
            },
            wait: {
                type: "integer",
                minimum: 0,
                maximum: 6
            }
        },
        required: ["secret", "content"]
    },

    getStorage: {
        id: 'transactions.getStorage',
        type: 'object',
        properties: {
          id: {
            type: 'string',
            minLength: 1
          }
        },
        required: ['id']
    }
}