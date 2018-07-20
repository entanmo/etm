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

module.exports = {
    open: {
        id: 'accounts.open',
        type: 'object',
        properties: {
            secret: {
                type: 'string',
                minLength: 1,
                maxLength: 100
            }
        },
        requied: ['secret']
    },

    open2: {
        id: 'accounts.open2',
        type: 'object',
        properties: {
            publicKey: {
                type: 'string',
                format: 'publicKey'
            }
        },
        requied: ['publicKey']
    },

    getBalance: {
        id: 'acounts.getBalance',
        type: 'object',
        properties: {
        address: {
            type: 'string',
            minLength: 1,
            maxLength: 50
        }
        },
        required: ['address']
    },

    getPublicKey: {
        id: 'accounts.getPublicKey',
        type: 'object',
        properties: {
        address: {
            type: 'string',
            minLength: 1
        }
        },
        required: ['address']
    },

    generatePublicKey: {
        id: 'accounts.generatePublicKey',
        type: 'object',
        properties: {
        secret: {
            type: 'string',
            minLength: 1
        }
        },
        required: ['secret']
    },

    getDelegates: {
        id: 'accounts.getDelegates',
        type: 'object',
        properties: {
        address: {
            type: 'string',
            minLength: 1
        }
        },
        required: ['address']
    },

    addDelegates: {
        id: 'accounts.addDelegates',
        type: 'object',
        properties: {
            secret: {
                type: 'string',
                minLength: 1
            },
            publicKey: {
                type: 'string',
                format: 'publicKey'
            },
            secondSecret: {
                type: 'string',
                minLength: 1
            }
        }
    },

    getAccount: {
        id: 'accounts.getAccount',
        type: 'object',
        properties: {
        address: {
            type: 'string',
            minLength: 1
        }
        },
        required: ['address']
    },

    votes: {
        id: 'accounts.objectNormalize votes',
        type: 'object',
        properties: {
            votes: {
            type: 'array',
            minLength: 1,
            maxLength: slots.delegates,
            uniqueItems: true
            }
        },
        required: ['votes']
    },

    top: {
        id: 'account.top',
        type: "object",
        properties: {
            limit: {
            type: "integer",
            minimum: 0,
            maximum: 100
            },
            offset: {
            type: "integer",
            minimum: 0
            }
        }
    }

}
