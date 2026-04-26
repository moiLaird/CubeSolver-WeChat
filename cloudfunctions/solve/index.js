// cloudfunctions/solve/index.js
const cloud = require('wx-server-sdk');
const Cube = require('cubejs');

let solverReady = false;
function ensureSolver() {
  if (!solverReady) {
    Cube.initSolver();
    solverReady = true;
  }
}

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

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

exports.main = async (event, context) => {
  const { state } = event;
  if (typeof state !== 'string' || state.length !== 54) {
    return { error: 'State must be 54 chars', steps: [] };
  }
  if (isSolved(state)) {
    return { steps: [], solved: true };
  }
  try {
    ensureSolver();
    const cube = Cube.fromString(state);
    const resultStr = cube.solve(20);
    const steps = resultStr.split(' ').filter(s => s.length > 0);
    return { steps, solved: false };
  } catch (err) {
    console.error('Solve error:', err);
    return { error: err.message || 'Solve failed', steps: [] };
  }
};
