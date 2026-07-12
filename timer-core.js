(function exposeTimerCore(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports){
    module.exports = api;
  } else {
    root.TimerCore = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createTimerCore(){
  function clamp(value, min, max){
    return Math.max(min, Math.min(max, value));
  }

  function remainingFromDeadline(deadlineMs, nowMs){
    return Math.max(0, deadlineMs - nowMs);
  }

  function elapsedFraction(totalMs, remainingMs){
    if(totalMs <= 0) return 0;
    return clamp((totalMs - remainingMs) / totalMs, 0, 1);
  }

  return { clamp, remainingFromDeadline, elapsedFraction };
});
