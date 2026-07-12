const assert = require('node:assert/strict');
const TimerCore = require('../timer-core.js');

assert.equal(TimerCore.remainingFromDeadline(10000,2500),7500);
assert.equal(TimerCore.remainingFromDeadline(10000,12500),0);
assert.equal(TimerCore.elapsedFraction(10000,10000),0);
assert.equal(TimerCore.elapsedFraction(10000,7500),0.25);
assert.equal(TimerCore.elapsedFraction(10000,5000),0.5);
assert.equal(TimerCore.elapsedFraction(10000,0),1);
assert.equal(TimerCore.clamp(12,0,10),10);

console.log('Timer core tests passed.');
