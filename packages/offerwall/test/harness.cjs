// Tiny React + React Native stand-ins for rendering the package's components in node (shared by the v3 tests).
const Module = require('node:module');

function withReact(run, opts = {}) {
  const original = Module._load;
  const opened = [];
  class Value { constructor(v) { this.v = v; } interpolate() { return 0; } setValue(v) { this.v = v; } }
  // Records the blink: each Animated.loop(...).start() / .stop(), and the timing steps inside it.
  const anim = {loops: 0, stops: 0, running: 0, steps: []};
  const reduce = {enabled: opts.reduceMotion === true, listeners: []};
  const rn = {
    Platform: {OS: 'android'},
    NativeModules: {RNAdPopcornRewardModule: {}, ...(opts.nativeModules || {})},
    UIManager: {getViewManagerConfig: () => ({})},
    requireNativeComponent: () => 'NativeWall',
    BackHandler: {addEventListener: () => ({remove() {}})},
    Dimensions: {get: () => ({width: 400, height: 800})},
    Animated: {
      Value,
      timing: (value, config) => ({start() {}, stop() {}, value, config}),
      sequence: steps => ({start() {}, stop() {}, steps}),
      loop: inner => ({
        start() { anim.loops++; anim.running++; anim.steps = (inner.steps || []).map(s => s.config); },
        stop() { anim.stops++; anim.running--; },
      }),
      View: 'Animated.View',
    },
    Easing: {inOut: f => f, ease: 'ease', sin: 'sin'},
    AccessibilityInfo: {
      isReduceMotionEnabled: async () => reduce.enabled,
      addEventListener: (name, cb) => { reduce.listeners.push(cb); return {remove() { reduce.listeners = reduce.listeners.filter(l => l !== cb); }}; },
    },
    __anim: anim, __reduce: reduce,
    View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', Modal: 'Modal', SafeAreaView: 'SafeAreaView',
    __subs: [], __removed: 0,
  };
  rn.NativeEventEmitter = class { constructor(mod) { this.mod = mod; } addListener(name, cb) { rn.__subs.push([this.mod, name, cb]); return {remove() { rn.__removed++; }}; } };
  const native = {setUserId() {}, setStyle() {}, openOfferwall: () => opened.push('wall'), addListener: () => ({remove() {}})};
  let current;
  const react = {
    Fragment: 'Fragment',
    createElement: (type, props, ...children) => ({type, props: props || {}, children: children.flat(Infinity)}),
    useRef: v => { const i = current.cursor++; return current.slots[i] ??= {current: v}; },
    useState: init => {
      const h = current, i = h.cursor++;
      if (!(i in h.slots)) h.slots[i] = typeof init === 'function' ? init() : init;
      return [h.slots[i], v => { h.slots[i] = typeof v === 'function' ? v(h.slots[i]) : v; }];
    },
    useEffect: (cb, deps) => {
      const h = current, i = h.cursor++, prev = h.slots[i];
      if (!prev || !deps || deps.some((d, j) => d !== prev.deps[j])) { prev?.cleanup?.(); h.slots[i] = {deps, cleanup: undefined, run: cb}; h.pending.push(h.slots[i]); }
    },
  };
  Module._load = function (id, ...rest) {
    if (id === 'react') return react;
    if (id === 'react-native') return rn;
    if (id === 'react-native-adpopcorn-reward') return {default: native};
    return original.call(this, id, ...rest);
  };
  const made = [];
  const make = () => {
    const h = {
      slots: [], cursor: 0, pending: [],
      render(fn) { current = this; this.cursor = 0; return expand(fn()); },
      flush() { for (const e of this.pending.splice(0)) e.cleanup = e.run(); },
    };
    made.push(h);
    return h;
  };
  // Unmount everything so one test's listeners never answer the next test's requests.
  const dispose = () => { for (const h of made) for (const s of h.slots) if (typeof s?.cleanup === 'function') s.cleanup(); };
  return Promise.resolve(run({host: make(), make, opened, rn})).finally(() => { dispose(); Module._load = original; });
}
const texts = node => node == null || typeof node === 'boolean' ? [] : typeof node === 'string' ? [node] : [...(node.children || [])].flatMap(texts);
const walk = (node, out = []) => { if (node && typeof node === 'object') { out.push(node); (node.children || []).forEach(c => walk(c, out)); } return out; };
// Resolve function components inside the same render pass so their hooks keep a stable order.
function expand(node) {
  if (!node || typeof node !== 'object') return node;
  if (typeof node.type === 'function') return expand(node.type({...node.props, children: node.children[0]}));
  return {...node, children: (node.children || []).map(expand)};
}
const byLabel = (tree, label, startsWith = false) => walk(tree).find(n => n.type === 'Pressable' && typeof n.props.accessibilityLabel === 'string'
  && (startsWith ? n.props.accessibilityLabel.startsWith(label) : n.props.accessibilityLabel === label));
const hasType = (tree, type) => walk(tree).some(n => n.type === type);
const tick = (ms = 5) => new Promise(r => setTimeout(r, ms));
// The guide sheet is the Animated.View pinned to the bottom (the blinking chip's wrapper is an Animated.View too).
const findSheet = tree => walk(tree).find(n => n.type === 'Animated.View' && n.props.style && n.props.style.bottom === 0);
const hasSheet = tree => !!findSheet(tree);

module.exports = {withReact, texts, walk, expand, byLabel, hasType, tick, findSheet, hasSheet};
