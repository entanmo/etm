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
    multisignature: {
        id: 'multisignature',
        type: "object",
        properties: {
            min: {
                type: "integer",
                minimum: 1,
                maximum: 15
            },
            keysgroup: {
                type: "array",
                minLength: 1,
                maxLength: 16
            },
            lifetime: {
                type: "integer",
                minimum: 1,
                maximum: 24
            }
        },
        required: ['min', 'keysgroup', 'lifetime']
    },

    getAccounts: {
        id: 'multisignatures.getAccounts',
        type: "object",
        properties: {
        publicKey: {
            type: "string",
            format: "publicKey"
        }
        },
        required: ['publicKey']
    },

    pending: {
        id: 'multisignatures.pending',
        type: "object",
        properties: {
        publicKey: {
            type: "string",
            format: "publicKey"
        }
        },
        required: ['publicKey']
    },

    sign: {
        id: 'multisignatures.sign',
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
            publicKey: {
                type: "string",
                format: "publicKey"
            },
            transactionId: {
                type: "string"
            }
        },
        required: ['transactionId', 'secret']
    },

    addMultisignature: {
        id: 'multisignatures.addMultisignature',
        type: "object",
        properties: {
            secret: {
                type: "string",
                minLength: 1,
                maxLength: 100
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
            min: {
                type: "integer",
                minimum: 2,
                maximum: 16
            },
            lifetime: {
                type: "integer",
                minimum: 1,
                maximum: 24
            },
            keysgroup: {
                type: "array",
                minLength: 1,
                maxLength: 10
            }
        },
        required: ['min', 'lifetime', 'keysgroup', 'secret']
    }
}