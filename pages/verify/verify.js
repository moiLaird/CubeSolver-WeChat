const { initSolver, solve } = require('../../utils/solver');

Page({
  data: {
    inputValue: '',
    steps: [],
    stepsText: '',
    errorMsg: '',
    solverInitializing: false,
    solved: false,
    initProgress: 0,
    initProgressTotal: 12,
    initMessage: ''
  },
  onLoad() {
    this.ensureSolver();
  },
  onProgress(step, total, msg) {
    this.setData({ initProgress: step, initProgressTotal: total, initPercent: Math.round((step / total) * 100), initMessage: msg });
  },
  ensureSolver() {
    const app = getApp();
    if (app.globalData.solverReady || this.data.solverInitializing) return;
    this.setData({ solverInitializing: true, initProgress: 0, initMessage: 'Preparing...' });
    wx.showLoading({ title: 'Initializing...', mask: true });
    initSolver((step, total, msg) => this.onProgress(step, total, msg))
      .then(() => {
        wx.hideLoading();
      })
      .catch(err => {
        wx.hideLoading();
        wx.showModal({ title: 'Init Failed', content: 'Solver failed to load.', showCancel: false });
        console.error(err);
      })
      .finally(() => this.setData({ solverInitializing: false }));
  },
  onInput(e) {
    this.setData({ inputValue: e.detail.value.toUpperCase(), errorMsg: '', solved: false });
  },
  onSolve() {
    const state = this.data.inputValue.trim();
    if (state.length !== 54) {
      this.setData({ errorMsg: 'State must be 54 chars', steps: [], stepsText: '', solved: false });
      return;
    }
    this.runSolve(state);
  },
  async runSolve(state) {
    wx.showLoading({ title: 'Solving...', mask: true });
    try {
      const steps = await solve(state);
      this.setData({ steps, stepsText: steps.join(' '), errorMsg: '', solved: true });
      wx.hideLoading();
      if (steps.length === 0) {
        wx.showToast({ title: 'Already solved', icon: 'success' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showModal({
        title: 'Solve Failed',
        content: err.message || 'Invalid cube state.',
        showCancel: false
      });
      this.setData({ errorMsg: err.message || 'Solve failed', steps: [], stepsText: '', solved: false });
    }
  }
});
