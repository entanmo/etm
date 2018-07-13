'use strict';

const PowState = {
    PENDING:            0,
    RUNNING:            1,
};

const OperationReq = {
    START_POW:          0,
    STOP_POW:           1,
    GET_STATE:          2,
}

const OperationResp = {
    ERROR:              -1,
    TIMEOUT:            -2,
    MINT_READY:         0,
    START_POW:          1,
    STOP_POW:           2,
    TERM_POW:           3,
    POW:                4,
    STATE:              5,
}

module.exports.PowState = PowState;
module.exports.OperationReq = OperationReq;
module.exports.OperationResp = OperationResp;