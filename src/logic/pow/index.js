'use strict';

const PoW = require('./src/pow');
const { PowState } = require('./src/constants');
const Responser = require('./src/responser');

PoW.PowState = PowState;
PoW.setResponser(new Responser());
module.exports = PoW;