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
var slots = require('../utils/slots.js');
var constants = require('../utils/constants');

module.exports = {
    launch: {
        id: 'dapps.launch',
        type: "object",
        properties: {
        params: {
            type: "array",
            minLength: 1
        },
        id: {
            type: 'string',
            minLength: 1
        },
        master: {
            type: "string",
            minLength: 0
        }
        },
        required: ["id"]
    },

    addTransactions: {
        id: 'dapps.addTransactions',
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
        publicKey: {
            type: "string",
            format: "publicKey"
        },
        secondSecret: {
            type: "string",
            minLength: 1,
            maxLength: 100
        },
        dappId: {
            type: "string",
            minLength: 1
        },
        multisigAccountPublicKey: {
            type: "string",
            format: "publicKey"
        }
        },
        required: ["secret", "amount", "dappId"]
    },

    sendWithdrawal: {
        id: 'dapps.sendWithdrawal',
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
            minLength: 1,
            maxLength: 50
        },
        secondSecret: {
            type: "string",
            minLength: 1,
            maxLength: 100
        },
        transactionId: {
            type: "string",
            minLength: 1,
            maxLength: 64
        },
        multisigAccountPublicKey: {
            type: "string",
            format: "publicKey"
        }
        },
        required: ["secret", 'recipientId', "amount", "transactionId"]
    },

    outTransfer: {
        id: 'outTransfer',
        type: 'object',
        properties: {
            dappId: {
            type: "string",
            minLength: 1
            },
            transactionId: {
            type: "string",
            minLength: 1
            },
            currency: {
            type: 'string',
            minLength: 1,
            maxLength: 22
            },
            amount: {
            type: 'string',
            minLength: 1,
            maxLength: 50
            }
        },
        required: ["dappId", "transactionId", "currency", "amount"]
    },

    inTransfer: {
        id: 'inTransfer',
        type: 'object',
        properties: {
            dappId: {
            type: "string",
            minLength: 1
            },
            currency: {
            type: 'string',
            minLength: 1,
            maxLength: 22
            },
            amount: {
            type: 'string',
            minLength: 0,
            maxLength: 50
            }
        },
        required: ["dappId", 'currency']
    },

    dapp: {
        id: 'dapp',
        type: "object",
        properties: {
            category: {
            type: "integer",
            minimum: 0,
            maximum: 9
            },
            name: {
            type: "string",
            minLength: 1,
            maxLength: 32
            },
            description: {
            type: "string",
            minLength: 0,
            maxLength: 160
            },
            tags: {
            type: "string",
            minLength: 0,
            maxLength: 160
            },
            type: {
            type: "integer",
            minimum: 0
            },
            link: {
            type: "string",
            minLength: 0,
            maxLength: 2000
            },
            icon: {
            type: "string",
            minLength: 0,
            maxLength: 2000
            },
            delegates: {
            type: "array",
            minLength: 5,
            maxLength: slots.delegates,
            uniqueItems: true
            },
            unlockDelegates: {
            type: "integer",
            minimum: 3,
            maximum: slots.delegates
            }
        },
        required: ["type", "name", "category", "delegates", "unlockDelegates"]
    }
}