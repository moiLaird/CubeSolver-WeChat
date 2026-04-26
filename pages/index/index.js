const { initSolver } = require('../../utils/solver');

Page({
  data: {
    solverReady: false,
    solverInitializing: false,
    initProgress: 0,
    initProgressTotal: 12,
    initPercent: 0,
    initMessage: ''
  },

  onLoad() {
    this.refreshStatus();
  },

  onShow() {
    this.refreshStatus();
  },

  refreshStatus() {
    const app = getApp();
    this.setData({ solverReady: app.globalData.solverReady });
  },

  onProgress(step, total, msg) {
    this.setData({ initProgress: step, initProgressTotal: total, initPercent: Math.round((step / total) * 100), initMessage: msg });
  },

  onInitSolver() {
    if (this.data.solverReady || this.data.solverInitializing) return;
    this.setData({ solverInitializing: true, initProgress: 0, initMessage: 'Preparing...' });
    wx.showLoading({ title: 'Initializing solver...', mask: true });
    initSolver((step, total, msg) => this.onProgress(step, total, msg))
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: 'Ready!', icon: 'success' });
        this.setData({ solverReady: true });
      })
      .catch(err => {
        wx.hideLoading();
        wx.showModal({ title: 'Init Failed', content: err.message || 'Solver failed to initialize.', showCancel: false });
        console.error(err);
      })
      .finally(() => this.setData({ solverInitializing: false }));
  },

  goScan() {
    wx.navigateTo({ url: '/pages/scan/scan' });
  },

  goVerify() {
    wx.navigateTo({ url: '/pages/verify/verify' });
  }
});