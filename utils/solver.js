const Cube = require('cubejs');

let initPromise = null;

function initSolver(onProgress) {
  if (initPromise) return initPromise;
  const app = getApp();
  if (app.globalData.solverReady) return Promise.resolve();

  const steps = ['twist', 'flip', 'FRtoBR', 'URFtoDLF', 'URtoDF', 'URtoUL', 'UBtoDF', 'mergeURtoDF', 'sliceTwist', 'sliceFlip', 'sliceURFtoDLFParity', 'sliceURtoDFParity'];
  const total = steps.length;

  initPromise = new Promise((resolve, reject) => {
    let idx = 0;

    function next() {
      if (idx >= total) {
        app.globalData.solverReady = true;
        if (onProgress) onProgress(total, total, 'Ready');
        resolve();
        return;
      }

      idx++;
      if (onProgress) onProgress(idx, total, steps[idx - 1]);

      try {
        if (idx === 1) Cube.computeMoveTables('twist');
        else if (idx === 2) Cube.computeMoveTables('flip');
        else if (idx === 3) Cube.computeMoveTables('FRtoBR');
        else if (idx === 4) Cube.computeMoveTables('URFtoDLF');
        else if (idx === 5) Cube.computeMoveTables('URtoDF');
        else if (idx === 6) Cube.computeMoveTables('URtoUL');
        else if (idx === 7) Cube.computeMoveTables('UBtoDF');
        else if (idx === 8) Cube.computeMoveTables('mergeURtoDF');
        else if (idx === 9) Cube.computePruningTables('sliceTwist');
        else if (idx === 10) Cube.computePruningTables('sliceFlip');
        else if (idx === 11) Cube.computePruningTables('sliceURFtoDLFParity');
        else if (idx === 12) Cube.computePruningTables('sliceURtoDFParity');
      } catch (err) {
        app.globalData.solverError = err;
        reject(err);
        initPromise = null;
        return;
      }

      setTimeout(next, 10);
    }

    next();
  });

  return initPromise;
}

function isSolved(stateStr) {
  for (let i = 0; i < 6; i++) {
    const start = i * 9;
    const c = stateStr[start];
    for (let j = 1; j < 9; j++) {
      if (stateStr[start + j] !== c) return false;
    }
  }
  return true;
}

function solve(stateStr) {
  const app = getApp();
  if (!app || !app.globalData.solverReady) {
    throw new Error('Solver not initialized yet.');
  }
  if (typeof stateStr !== 'string' || stateStr.length !== 54) {
    throw new Error('State must be exactly 54 characters.');
  }

  const VALID_CHARS = { U: 0, R: 0, F: 0, D: 0, L: 0, B: 0 };
  for (const ch of stateStr) {
    if (VALID_CHARS[ch] === undefined) {
      throw new Error('State contains invalid character: ' + ch);
    }
    VALID_CHARS[ch]++;
  }
  for (const name of ['U', 'R', 'F', 'D', 'L', 'B']) {
    if (VALID_CHARS[name] !== 9) {
      throw new Error('Each colour must appear exactly 9 times. ' + name + ' appears ' + VALID_CHARS[name] + ' times.');
    }
  }

  if (isSolved(stateStr)) {
    console.log('solver: State already solved.');
    return [];
  }
  console.log('solver: Solving state:', stateStr);
  const cube = Cube.fromString(stateStr);
  const resultStr = cube.solve(20);
  console.log('solver: Raw result:', JSON.stringify(resultStr));
  const steps = resultStr.split(' ').filter(s => s.length > 0);
  console.log('solver: Parsed steps:', steps);
  return steps;
}

module.exports = { initSolver, solve };