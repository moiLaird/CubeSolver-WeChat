const COLORS = {
  U: '#FFD700', R: '#FF0000', F: '#0000FF',
  D: '#FFFFFF', L: '#FFA500', B: '#00FF00'
};

const HALF = 0.5;
const C1 = 1 / Math.sqrt(2);
const C2 = 1 / Math.sqrt(6);

const FACE_VERTICES = {
  '+X': [[HALF,-HALF,-HALF],[HALF,HALF,-HALF],[HALF,HALF,HALF],[HALF,-HALF,HALF]],
  '-X': [[-HALF,-HALF,HALF],[-HALF,HALF,HALF],[-HALF,HALF,-HALF],[-HALF,-HALF,-HALF]],
  '+Y': [[-HALF,HALF,-HALF],[-HALF,HALF,HALF],[HALF,HALF,HALF],[HALF,HALF,-HALF]],
  '-Y': [[-HALF,-HALF,HALF],[-HALF,-HALF,-HALF],[HALF,-HALF,-HALF],[HALF,-HALF,HALF]],
  '+Z': [[-HALF,-HALF,HALF],[-HALF,HALF,HALF],[HALF,HALF,HALF],[HALF,-HALF,HALF]],
  '-Z': [[HALF,-HALF,-HALF],[HALF,HALF,-HALF],[-HALF,HALF,-HALF],[-HALF,-HALF,-HALF]]
};

const NORMALS = {
  '+X': [1,0,0], '-X': [-1,0,0],
  '+Y': [0,1,0], '-Y': [0,-1,0],
  '+Z': [0,0,1], '-Z': [0,0,-1]
};

const CUBIE_DEFS = [
  { pos: [0,1,0],  faces: { '+Y': 4 } },
  { pos: [1,0,0],  faces: { '+X': 13 } },
  { pos: [0,0,1],  faces: { '+Z': 22 } },
  { pos: [0,-1,0], faces: { '-Y': 31 } },
  { pos: [-1,0,0], faces: { '-X': 40 } },
  { pos: [0,0,-1], faces: { '-Z': 49 } },
  { pos: [1,1,1],   faces: { '+X': 9,  '+Y': 8,  '+Z': 20 } },
  { pos: [-1,1,1],  faces: { '-X': 38, '+Y': 6,  '+Z': 18 } },
  { pos: [1,1,-1],  faces: { '+X': 11, '+Y': 2,  '-Z': 45 } },
  { pos: [-1,1,-1], faces: { '-X': 36, '+Y': 0,  '-Z': 47 } },
  { pos: [1,-1,1],  faces: { '+X': 15, '-Y': 29, '+Z': 26 } },
  { pos: [-1,-1,1], faces: { '-X': 44, '-Y': 27, '+Z': 24 } },
  { pos: [1,-1,-1], faces: { '+X': 17, '-Y': 35, '-Z': 51 } },
  { pos: [-1,-1,-1],faces: { '-X': 42, '-Y': 33, '-Z': 53 } },
  { pos: [0,1,1],   faces: { '+Y': 7,  '+Z': 19 } },
  { pos: [1,1,0],   faces: { '+X': 10, '+Y': 5 } },
  { pos: [0,1,-1],  faces: { '+Y': 1,  '-Z': 46 } },
  { pos: [-1,1,0],  faces: { '-X': 37, '+Y': 3 } },
  { pos: [1,0,1],   faces: { '+X': 12, '+Z': 23 } },
  { pos: [-1,0,1],  faces: { '-X': 41, '+Z': 21 } },
  { pos: [1,0,-1],  faces: { '+X': 14, '-Z': 48 } },
  { pos: [-1,0,-1], faces: { '-X': 39, '-Z': 50 } },
  { pos: [0,-1,1],  faces: { '-Y': 28, '+Z': 25 } },
  { pos: [1,-1,0],  faces: { '+X': 16, '-Y': 32 } },
  { pos: [0,-1,-1], faces: { '-Y': 34, '-Z': 52 } },
  { pos: [-1,-1,0], faces: { '-X': 43, '-Y': 30 } }
];

function isVisible(nx, ny, nz) {
  return nx + ny + nz > 0;
}

function applyRot(x, y, z, rot) {
  return {
    x: rot[0]*x + rot[1]*y + rot[2]*z,
    y: rot[3]*x + rot[4]*y + rot[5]*z,
    z: rot[6]*x + rot[7]*y + rot[8]*z
  };
}

function project(x, y, z, scale, centerX, centerY) {
  const px = (x - z) * C1;
  const py = (x - 2*y + z) * C2;
  return {
    x: px * scale + centerX,
    y: py * scale + centerY
  };
}

function createSolvedCubies() {
  const I = [1,0,0,0,1,0,0,0,1];
  return CUBIE_DEFS.map(def => ({
    pos: [...def.pos],
    rot: [...I],
    faces: { ...def.faces }
  }));
}

function decodeState(stateStr) {
  if (!stateStr || stateStr.length !== 54) return createSolvedCubies();
  const I = [1,0,0,0,1,0,0,0,1];
  return CUBIE_DEFS.map(def => {
    const faces = {};
    for (const [dir, idx] of Object.entries(def.faces)) {
      const ch = stateStr[idx];
      if (ch && COLORS[ch]) faces[dir] = ch;
    }
    return { pos: [...def.pos], rot: [...I], faces };
  });
}

function parseStep(step) {
  const face = step[0];
  const mod = step[1] || '';
  let axis, layer, angle;
  switch (face) {
    case 'U': axis = 'y'; layer = 1;  angle = -90; break;
    case 'D': axis = 'y'; layer = -1; angle = 90;  break;
    case 'R': axis = 'x'; layer = 1;  angle = -90; break;
    case 'L': axis = 'x'; layer = -1; angle = 90;  break;
    case 'F': axis = 'z'; layer = 1;  angle = -90; break;
    case 'B': axis = 'z'; layer = -1; angle = 90;  break;
    default: return null;
  }
  if (mod === "'") angle = -angle;
  if (mod === '2') angle = angle * 2;
  return { axis, layer, angleDeg: angle, angle: angle * Math.PI / 180 };
}

function rotatePoint(p, axis, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const [x, y, z] = p;
  if (axis === 'x') return [x, y*c - z*s, y*s + z*c];
  if (axis === 'y') return [x*c + z*s, y, -x*s + z*c];
  return [x*c - y*s, x*s + y*c, z];
}

function makeRotMatrix(axis, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  if (axis === 'x') return [1,0,0, 0,c,-s, 0,s,c];
  if (axis === 'y') return [c,0,s, 0,1,0, -s,0,c];
  return [c,-s,0, s,c,0, 0,0,1];
}

function multiplyMat(a, b) {
  return [
    a[0]*b[0]+a[1]*b[3]+a[2]*b[6], a[0]*b[1]+a[1]*b[4]+a[2]*b[7], a[0]*b[2]+a[1]*b[5]+a[2]*b[8],
    a[3]*b[0]+a[4]*b[3]+a[5]*b[6], a[3]*b[1]+a[4]*b[4]+a[5]*b[7], a[3]*b[2]+a[4]*b[5]+a[5]*b[8],
    a[6]*b[0]+a[7]*b[3]+a[8]*b[6], a[6]*b[1]+a[7]*b[4]+a[8]*b[7], a[6]*b[2]+a[7]*b[5]+a[8]*b[8]
  ];
}

function quantizeCubie(c) {
  c.pos = c.pos.map(v => Math.round(v));
  c.rot = c.rot.map(v => {
    if (Math.abs(v) < 0.3) return 0;
    return Math.abs(v - 1) < 0.3 ? 1 : (Math.abs(v + 1) < 0.3 ? -1 : v);
  });
}

Component({
  properties: {
    initialState: { type: String, value: '' },
    solutionSteps: { type: Array, value: [] },
    currentStep: { type: Number, value: 0 }
  },
  data: {
    isPlaying: false
  },
  lifetimes: {
    ready() {
      this._initCanvas();
      this._initFromProps();
    }
  },
  observers: {
    'initialState, solutionSteps': function() {
      this._initFromProps();
    }
  },
  methods: {
    _initFromProps() {
      this._cubies = decodeState(this.properties.initialState);
      this._currentStep = this.properties.currentStep || 0;
      this._isPlaying = false;
      this._animState = 'idle';
      if (this._timer) { clearTimeout(this._timer); this._timer = null; }
      this.draw();
    },

    _initCanvas() {
      const query = wx.createSelectorQuery().in(this);
      query.select('#cube3dCanvas').fields({ node: true, size: true }).exec((res) => {
        if (!res || !res[0]) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio;
        const w = res[0].width;
        const h = res[0].height;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
        this._canvas = canvas;
        this._ctx = ctx;
        this._dpr = dpr;
        this._width = w;
        this._height = h;
        this.draw();
      });
    },

    draw() {
      if (!this._ctx) return;
      const ctx = this._ctx;
      const w = this._width;
      const h = this._height;
      ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const scale = Math.min(w, h) * 0.18;
      const cx = w / 2;
      const cy = h * 0.52;
      const faces = [];

      for (const cubie of this._cubies) {
        const pos = cubie.pos;
        const rot = cubie.rot;
        for (const [faceKey, colorName] of Object.entries(cubie.faces)) {
          const normal = NORMALS[faceKey];
          const wn = applyRot(normal[0], normal[1], normal[2], rot);
          if (!isVisible(wn.x, wn.y, wn.z)) continue;
          const lc = [normal[0]*HALF, normal[1]*HALF, normal[2]*HALF];
          const wc = {
            x: pos[0] + rot[0]*lc[0] + rot[1]*lc[1] + rot[2]*lc[2],
            y: pos[1] + rot[3]*lc[0] + rot[4]*lc[1] + rot[5]*lc[2],
            z: pos[2] + rot[6]*lc[0] + rot[7]*lc[1] + rot[8]*lc[2]
          };
          const depth = wc.x + wc.y + wc.z;
          const verts = FACE_VERTICES[faceKey].map(v => {
            const rv = applyRot(v[0], v[1], v[2], rot);
            return project(pos[0]+rv.x, pos[1]+rv.y, pos[2]+rv.z, scale, cx, cy);
          });
          const c2x = (verts[0].x + verts[1].x + verts[2].x + verts[3].x) / 4;
          const c2y = (verts[0].y + verts[1].y + verts[2].y + verts[3].y) / 4;
          const shrunk = verts.map(v => ({
            x: c2x + (v.x - c2x) * 0.93,
            y: c2y + (v.y - c2y) * 0.93
          }));
          faces.push({ verts: shrunk, color: COLORS[colorName], depth });
        }
      }
      faces.sort((a, b) => a.depth - b.depth);
      for (const f of faces) {
        ctx.fillStyle = f.color;
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(f.verts[0].x, f.verts[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(f.verts[i].x, f.verts[i].y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      const step = this.properties.solutionSteps[this._currentStep];
      ctx.fillStyle = '#333';
      ctx.font = '14px sans-serif';
      const text = step ? `Step ${this._currentStep + 1}: ${step}` : 'Ready';
      ctx.fillText(text, 10, h - 10);
    },

    _applyStep(stepInfo) {
      const { axis, layer, angle } = stepInfo;
      const axisIdx = { x: 0, y: 1, z: 2 }[axis];
      const affected = this._cubies.filter(c => Math.abs(c.pos[axisIdx] - layer) < 0.1);
      for (const c of affected) {
        c.pos = rotatePoint(c.pos, axis, angle);
        c.rot = multiplyMat(makeRotMatrix(axis, angle), c.rot);
        quantizeCubie(c);
      }
    },

    _gotoStepDirect(n) {
      this._cubies = decodeState(this.properties.initialState);
      const steps = this.properties.solutionSteps;
      const target = Math.max(0, Math.min(n, steps.length));
      for (let i = 0; i < target; i++) {
        const info = parseStep(steps[i]);
        if (info) this._applyStep(info);
      }
      this._currentStep = target;
      this.draw();
    },

    _playNext() {
      if (!this._isPlaying || this._currentStep >= this.properties.solutionSteps.length) {
        this._isPlaying = false;
        this.setData({ isPlaying: false });
        return;
      }
      const stepInfo = parseStep(this.properties.solutionSteps[this._currentStep]);
      if (!stepInfo) {
        this._currentStep++;
        this._playNext();
        return;
      }
      this._animateStep(stepInfo, 300, () => {
        this._currentStep++;
        if (this._isPlaying && this._currentStep < this.properties.solutionSteps.length) {
          this._timer = setTimeout(() => this._playNext(), 200);
        } else {
          this._isPlaying = false;
          this.setData({ isPlaying: false });
        }
      });
    },

    _animateStep(stepInfo, duration, onDone) {
      const { axis, layer, angle } = stepInfo;
      const axisIdx = { x: 0, y: 1, z: 2 }[axis];
      const affected = this._cubies.filter(c => Math.abs(c.pos[axisIdx] - layer) < 0.1);
      const startData = affected.map(c => ({ cubie: c, pos: [...c.pos], rot: [...c.rot] }));
      const startTime = Date.now();
      this._animState = 'animating';
      const loop = () => {
        const elapsed = Date.now() - startTime;
        const t = Math.min(1, elapsed / duration);
        const eased = t * t * (3 - 2 * t);
        const curAngle = angle * eased;
        for (const sd of startData) {
          const c = sd.cubie;
          c.pos = rotatePoint(sd.pos, axis, curAngle);
          c.rot = multiplyMat(makeRotMatrix(axis, curAngle), sd.rot);
        }
        this.draw();
        if (t < 1) {
          this._timer = setTimeout(loop, 16);
        } else {
          for (const sd of startData) {
            quantizeCubie(sd.cubie);
          }
          this._animState = 'idle';
          if (onDone) onDone();
        }
      };
      loop();
    },

    play() {
      if (this._isPlaying || this._animState === 'animating') return;
      if (this._currentStep >= this.properties.solutionSteps.length) {
        this._currentStep = 0;
        this._gotoStepDirect(0);
      }
      this._isPlaying = true;
      this.setData({ isPlaying: true });
      this._playNext();
    },

    pause() {
      this._isPlaying = false;
      this.setData({ isPlaying: false });
      if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    },

    reset() {
      this.pause();
      this._gotoStepDirect(0);
    },

    gotoStep(index) {
      this.pause();
      const n = Math.max(0, Math.min(index, this.properties.solutionSteps.length));
      this._gotoStepDirect(n);
    }
  }
});
