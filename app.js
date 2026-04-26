App({
  globalData: {
    solverReady: false,
    solverError: null
  },
  onLaunch() {
    // Solver init is deferred to first use to avoid startup timeout.
  }
});
