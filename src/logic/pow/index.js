'use strict';

const PoW = require('./src/pow');
const { PowState } = require('./src/constants');
const DefaultResponser = require('./src/default_responser');

PoW.PowState = PowState;
PoW.setResponser(new DefaultResponser());
PoW.defaultResponser = PoW.getResponser();
module.exports = PoW;