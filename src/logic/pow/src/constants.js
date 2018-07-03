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
    START_POW:          0,
    STOP_POW:           1,
    TERM_POW:           2,
    POW:                3,
    STATE:              4,
}

module.exports.PowState = PowState;
module.exports.OperationReq = OperationReq;
module.exports.OperationResp = OperationResp;