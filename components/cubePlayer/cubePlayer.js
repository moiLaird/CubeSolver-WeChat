const COLORS = {
  U: '#FFD700', R: '#FF0000', F: '#0000FF',
  D: '#FFFFFF', L: '#FFA500', B: '#00FF00' 
};

Component({
  properties: {
    solutionSteps: { type: Array, value: [] },
    currentStep: { type: Number, value: 0 }
  },
  data: {
    isPlaying: false,
    timer: null
  },
  lifetimes: {
    attached() { this.draw(); }
  },
  observers: {
    'currentStep': function() { this.draw(); }
  },
  methods: {
    draw() {
      const query = wx.createSelectorQuery().in(this);
      query.select('#cubeCanvas').fields({ node: true, size: true }).exec((res) => {
        if (!res || !res[0]) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio;
        const width = res[0].width;
        const height = res[0].height;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        const cell = Math.min(width, height) / 14;
        const gap = 2;
        const faces = [
          { n: 'U', x: 3, y: 0 },
          { n: 'L', x: 0, y: 3 },
          { n: 'F', x: 3, y: 3 },
          { n: 'R', x: 6, y: 3 },
          { n: 'B', x: 9, y: 3 },
          { n: 'D', x: 3, y: 6 }
        ];

        ctx.save();
        ctx.translate(width / 2 - 5.5 * (cell + gap), height / 2 - 4.5 * (cell + gap));
        faces.forEach(f => {
          for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
              ctx.fillStyle = COLORS[f.n];
              ctx.strokeStyle = '#333';
              ctx.lineWidth = 1;
              ctx.fillRect((f.x + c) * (cell + gap), (f.y + r) * (cell + gap), cell, cell);
              ctx.strokeRect((f.x + c) * (cell + gap), (f.y + r) * (cell + gap), cell, cell);
            }
          }
        });

        const step = this.data.solutionSteps[this.data.currentStep];
        if (step) {
          const faceName = step[0];
          const f = faces.find(item => item.n === faceName);
          if (f) {
            ctx.strokeStyle = '#e64340';
            ctx.lineWidth = 3;
            ctx.strokeRect(f.x * (cell + gap) - 2, f.y * (cell + gap) - 2, 3 * (cell + gap), 3 * (cell + gap));
          }
        }
        ctx.restore();

        ctx.fillStyle = '#333';
        ctx.font = '14px sans-serif';
        const text = step ? 'Step ' + (this.data.currentStep + 1) + ': ' + step : 'Ready';
        ctx.fillText(text, 10, height - 10);
      });
    },

    play() {
      if (this.data.isPlaying) return;
      this.setData({ isPlaying: true });
      const loop = () => {
        if (!this.data.isPlaying) return;
        let next = this.data.currentStep + 1;
        if (next >= this.data.solutionSteps.length) {
          this.setData({ isPlaying: false });
          return;
        }
        this.setData({ currentStep: next });
        this.data.timer = setTimeout(loop, 800);
      };
      loop();
    },
    pause() {
      this.setData({ isPlaying: false });
      if (this.data.timer) clearTimeout(this.data.timer);
    },
    reset() {
      this.pause();
      this.setData({ currentStep: 0 });
    },
    gotoStep(index) {
      this.pause();
      const i = Math.max(0, Math.min(index, this.data.solutionSteps.length - 1));
      this.setData({ currentStep: i });
    }
  }
});
