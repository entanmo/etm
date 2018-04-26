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
    getIssuers: {
        id: 'uia.getIssusers',
        type: 'object',
        properties: {
            limit: {
                type: 'integer',
                minimum: 0,
                maximum: 100
            },
            offset: {
                type: 'integer',
                minimum: 0
            }
        }
    },

    getIssuer: {
        id: 'uia.getIssuer',
        type: 'object',
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 16
          }
        },
        required: ['name']
    },

    getIssuerAssets: {
        id: 'uia.getIssuerAssets',
        type: 'object',
        properties: {
          limit: {
            type: 'integer',
            minimum: 0,
            maximum: 100
          },
          offset: {
            type: 'integer',
            minimum: 0
          }
        }       
    },

    getAssets: {
        id: 'uia.getAssets',
        type: 'object',
        properties: {
            limit: {
                type: 'integer',
                minimum: 0,
                maximum: 100
            },
            offset: {
                type: 'integer',
                minimum: 0
            }
        }
    },

    getAsset: {
        id: 'uia.getAsset',
        type: 'object',
        properties: {
            name: {
                type: 'string',
                minLength: 1,
                maxLength: 32
            }
        },
        required: ['name']
    },

    getAssetAcl: {
        id: 'uia.getAssetAcl',
        type: 'object',
        properties: {
            limit: {
                type: 'integer',
                minimum: 0,
                maximum: 100
            },
            offset: {
                type: 'integer',
                minimum: 0
            }
        }
    },

    getBalances: {
        id: 'uia.getBalances',
        type: 'object',
        properties: {
            limit: {
                type: 'integer',
                minimum: 0,
                maximum: 100
            },
            offset: {
                type: 'integer',
                minimum: 0
            }
        }
    },

    getMyTransactions: {
        id: 'uia.getMyTransactoins',
        type: 'object',
        properties: {
          limit: {
            type: 'integer',
            minimum: 0,
            maximum: 100
          },
          offset: {
            type: 'integer',
            minimum: 0
          }
        }        
    },

    getTransactions: {
        id: 'uia.getTransactions',
        type: 'object',
        properties: {
            limit: {
                type: 'integer',
                minimum: 0,
                maximum: 100
            },
            offset: {
                type: 'integer',
                minimum: 0
            }
        }
    },

    transferAsset: {
        id: 'uia.transferAsset',
        type: "object",
        properties: {
            secret: {
                type: "string",
                minLength: 1,
                maxLength: 100
            },
            currency: {
                type: "string",
                maxLength: 22
            },
            amount: {
                type: "string",
                maxLength: 50
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
        required: ["secret", "amount", "recipientId", "currency"]
    }
}
