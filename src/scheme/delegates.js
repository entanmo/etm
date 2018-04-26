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
    delegate: {
        id: 'delegate',
        type: "object",
        properties: {
            publicKey: {
            type: "string",
            format: "publicKey"
            }
        },
        required: ["publicKey"]
    },

    forgingEnable: {
        id: 'forgingEnable',
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
            }
        },
        required: ["secret"]
    },

    forgingDisable: {
        id: 'forgingDisable',
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
            }
        },
        required: ["secret"]
    },

    forgingStatus: {
        id: 'forgingStatus',
        type: "object",
        properties: {
            publicKey: {
            type: "string",
            format: "publicKey"
            }
        },
        required: ["publicKey"]
    },

    getDelegate: {
        id: 'delegates.getDelegate',
        type: "object",
        properties: {
        transactionId: {
            type: "string"
        },
        publicKey: {
            type: "string"
        },
        username: {
            type: "string"
        }
        }
    },

    getVoters: {
        id: 'delegates.getVoters',
        type: 'object',
        properties: {
        publicKey: {
            type: "string",
            format: "publicKey"
        }
        },
        required: ['publicKey']
    },

    getDelegates: {
        id: 'delegates.getDelegates',
        type: 'object',
        properties: {
            address: {
                type: "string",
                minLength: 1
            },
            limit: {
                type: "integer",
                minimum: 0,
                maximum: 101
            },
            offset: {
                type: "integer",
                minimum: 0
            },
            orderBy: {
                type: "string"
            }
        }
    },

    getForgedByAccount: {
        id: 'delegates.getForgedByAccount',
        type: "object",
        properties: {
        generatorPublicKey: {
            type: "string",
            format: "publicKey"
        }
        },
        required: ["generatorPublicKey"]
    },

    addDelegate: {
        id: 'delegates.addDelegate',
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
        username: {
            type: "string"
        }
        },
        required: ["secret"]
    }

}