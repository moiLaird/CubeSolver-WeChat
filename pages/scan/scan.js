const { rgbToHsv, sampleRegion, classifyWithReferencesHsv, enforceGlobalConstraint, REF_COLORS } = require('../../utils/colorClassifier');
const { initSolver, solve } = require('../../utils/solver');

const FACE_NAMES = ['U', 'R', 'F', 'D', 'L', 'B'];
const FACE_LABELS = ['U (Yellow)', 'R (Red)', 'F (Blue)', 'D (White)', 'L (Orange)', 'B (Green)'];

const COLOR_OPTIONS = [
  { name: 'U', bg: '#FFD700' },
  { name: 'R', bg: '#FF0000' },
  { name: 'F', bg: '#0000FF' },
  { name: 'D', bg: '#FFFFFF', border: '1rpx solid #ccc' },
  { name: 'L', bg: '#FFA500' },
  { name: 'B', bg: '#00FF00' }
];

const STD_COLORS = {
  U: '#FFD700',
  R: '#FF0000',
  F: '#0000FF',
  D: '#FFFFFF',
  L: '#FFA500',
  B: '#00FF00'
};

Page({
  data: {
    phase: 'capture',
    currentFaceIndex: 0,
    photoPaths: ['', '', '', '', '', ''],
    faces: [[], [], [], [], [], []],
    rawColors: [[], [], [], [], [], []],
    displayColors: [[], [], [], [], [], []],
    selectedCell: null,
    steps: [],
    stepsText: '',
    errorMsg: '',
    solverInitializing: false,
    initProgress: 0,
    initProgressTotal: 12,
    initPercent: 0,
    initMessage: ''
  },
  canvas: null,
  ctx: null,

  onLoad() {
    this.setData({ COLOR_OPTIONS, FACE_NAMES, FACE_LABELS });
  },

  onReady() {
    const query = wx.createSelectorQuery();
    query.select('#analyzeCanvas').fields({ node: true, size: true }).exec((res) => {
      if (res && res[0]) {
        this.canvas = res[0].node;
        this.ctx = this.canvas.getContext('2d');
      }
    });
  },

  onProgress(step, total, msg) {
    this.setData({ initProgress: step, initProgressTotal: total, initPercent: Math.round((step / total) * 100), initMessage: msg });
  },

  takePhoto() {
    wx.showLoading({ title: 'Opening camera...', mask: true });
    wx.chooseImage({
      count: 1,
      sizeType: ['original'],
      sourceType: ['camera'],
      success: (res) => {
        wx.hideLoading();
        if (!res.tempFilePaths || !res.tempFilePaths[0]) return;
        const path = res.tempFilePaths[0];
        const idx = this.data.currentFaceIndex;
        const paths = this.data.photoPaths.slice();
        paths[idx] = path;

        if (idx < 5) {
          this.setData({ photoPaths: paths, currentFaceIndex: idx + 1 });
          setTimeout(() => this.takePhoto(), 150);
        } else {
          this.setData({ photoPaths: paths, currentFaceIndex: 6 });
          this.analyzeAll();
        }
      },
      fail: (err) => {
        wx.hideLoading();
        if (err.errMsg && err.errMsg.indexOf('cancel') !== -1) return;
        wx.showToast({ title: 'Camera failed. Check settings.', icon: 'none' });
      }
    });
  },

  analyzeAll() {
    if (!this.canvas || !this.ctx) {
      wx.showToast({ title: 'Canvas not ready', icon: 'none' });
      return;
    }
    wx.showLoading({ title: 'Analyzing 6 faces...', mask: true });

    const rawColors = [[], [], [], [], [], []];
    let done = 0;

    const processOne = (faceIndex) => {
      return new Promise((resolve, reject) => {
        const img = this.canvas.createImage();
        img.onload = () => {
          this.canvas.width = img.width;
          this.canvas.height = img.height;
          this.ctx.drawImage(img, 0, 0);
          const w = this.canvas.width;
          const h = this.canvas.height;
          const imageData = this.ctx.getImageData(0, 0, w, h);
          const d = imageData.data;

          const side = Math.min(w, h) * 0.70;
          const spacing = side / 3;
          const normalRadius = Math.floor(spacing * 0.28);
          const offsetX = (w - side) / 2;
          const offsetY = (h - side) / 2;

          const cells = [];
          for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
              const cx = Math.floor(offsetX + spacing * col + spacing / 2);
              const cy = Math.floor(offsetY + spacing * row + spacing / 2);
              // centre cell (ci=4) gets larger radius and more aggressive trim
              const ci = row * 3 + col;
              if (ci === 4) {
                cells.push(sampleRegion(d, w, h, cx, cy, Math.floor(spacing * 0.42), 0.25));
              } else {
                cells.push(sampleRegion(d, w, h, cx, cy, normalRadius));
              }
            }
          }
          rawColors[faceIndex] = cells;
          done++;
          wx.showLoading({ title: 'Analyzing ' + done + '/6...', mask: true });
          resolve();
        };
        img.onerror = reject;
        img.src = this.data.photoPaths[faceIndex];
      });
    };

    const run = async () => {
      try {
        for (let i = 0; i < 6; i++) {
          await processOne(i);
        }

        // Build HSV references from centre cells, with validation fallback
        const referencesHsv = rawColors.map((cells, fi) => {
          const c = cells[4];
          const name = FACE_NAMES[fi];
          const hsv = rgbToHsv(c.r, c.g, c.b);

          if (name === 'D') {
            // White face: centre block must be low-saturation, high-value
            if (hsv.s < 0.35 && hsv.v > 0.75) {
              return { name, h: hsv.h, s: hsv.s, v: hsv.v };
            }
          } else {
            if (hsv.s > 0.4) {
              return { name, h: hsv.h, s: hsv.s, v: hsv.v };
            }
          }

          // Fallback to default reference colour
          const def = REF_COLORS.find(ref => ref.name === name);
          return { name, h: def.h, s: def.s, v: def.v };
        });

        const faces = [[], [], [], [], [], []];
        const displayColors = [[], [], [], [], [], []];
        for (let fi = 0; fi < 6; fi++) {
          for (let ci = 0; ci < 9; ci++) {
            const c = rawColors[fi][ci];
            if (ci === 4) {
              faces[fi].push(FACE_NAMES[fi]);
              displayColors[fi].push(STD_COLORS[FACE_NAMES[fi]]);
            } else {
              faces[fi].push(classifyWithReferencesHsv(c.r, c.g, c.b, referencesHsv));
              displayColors[fi].push('rgb(' + c.r + ',' + c.g + ',' + c.b + ')');
            }
          }
        }

        const constrainedFaces = enforceGlobalConstraint(faces, rawColors, referencesHsv);

        this.setData({
          phase: 'review',
          faces: constrainedFaces,
          rawColors: rawColors,
          displayColors: displayColors,
          selectedCell: null
        });

        wx.hideLoading();
      } catch (e) {
        wx.hideLoading();
        wx.showToast({ title: 'Analysis failed', icon: 'none' });
      }
    };

    run();
  },

  onSelectCell(e) {
    const { face, index } = e.currentTarget.dataset;
    this.setData({ selectedCell: { faceIndex: face, cellIndex: index } });
  },

  onPickColor(e) {
    const { color } = e.currentTarget.dataset;
    const sc = this.data.selectedCell;
    if (!sc) {
      wx.showToast({ title: 'Tap a cell first', icon: 'none' });
      return;
    }
    const faces = this.data.faces.map(f => f.slice());
    const displayColors = this.data.displayColors.map(f => f.slice());
    faces[sc.faceIndex][sc.cellIndex] = color;
    displayColors[sc.faceIndex][sc.cellIndex] = STD_COLORS[color];
    this.setData({ faces, displayColors });
  },

  onSolve() {
    const { faces } = this.data;
    for (let i = 0; i < 6; i++) {
      if (faces[i].length !== 9) {
        wx.showModal({ title: 'Incomplete', content: 'Some faces are missing data.', showCancel: false });
        return;
      }
      if (faces[i].includes('?')) {
        wx.showModal({ title: 'Unconfirmed Colours', content: FACE_LABELS[i] + ' has unconfirmed cells (?). Please tap the cell and pick a colour.', showCancel: false });
        return;
      }
    }
    const stateStr = faces.map(f => f.join('')).join('');
    const app = getApp();
    if (!app.globalData.solverReady) {
      this.setData({ solverInitializing: true, initProgress: 0, initMessage: 'Preparing...' });
      wx.showLoading({ title: 'Initializing solver...', mask: true });
      initSolver((step, total, msg) => this.onProgress(step, total, msg))
        .then(() => {
          wx.hideLoading();
          this.setData({ solverInitializing: false });
          this.runSolve(stateStr);
        })
        .catch(err => {
          wx.hideLoading();
          this.setData({ solverInitializing: false });
          wx.showModal({ title: 'Error', content: err.message, showCancel: false });
        });
      return;
    }
    this.runSolve(stateStr);
  },

  async runSolve(stateStr) {
    wx.showLoading({ title: 'Solving...', mask: true });
    try {
      const steps = await solve(stateStr);
      this.setData({ phase: 'result', steps, stepsText: steps.join(' '), errorMsg: '', initialState: stateStr });
      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      wx.showModal({ title: 'Solve Failed', content: err.message || 'Invalid cube state.', showCancel: false });
      this.setData({ errorMsg: err.message || 'Solve failed' });
    }
  },

  onRetakeAll() {
    this.setData({
      phase: 'capture',
      currentFaceIndex: 0,
      photoPaths: ['', '', '', '', '', ''],
      faces: [[], [], [], [], [], []],
      rawColors: [[], [], [], [], [], []],
      displayColors: [[], [], [], [], [], []],
      steps: [],
      stepsText: '',
      errorMsg: '',
      selectedCell: null,
      solverInitializing: false,
      initProgress: 0,
      initMessage: ''
    });
  }
});