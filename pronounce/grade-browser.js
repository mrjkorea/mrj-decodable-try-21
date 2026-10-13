/* MRJ Pronounce — Citrinet-only in-page grader (int8 ONNX, onnxruntime-web WASM). */
(function (global) {
  const DEFAULT_ORIGIN = 'https://mrjkorea.github.io/pronounce/';
  let origin = DEFAULT_ORIGIN;
  const TRIAL_VER = '20261013-citrinet';

  let booted = null;
  let trialApi = null;

  function ortSrc() {
    return origin + 'vendor/ort/ort.wasm.min.js';
  }
  function trialSrc() {
    return origin + 'src/trial.js?v=' + TRIAL_VER;
  }
  function wasmPaths() {
    return origin + 'vendor/ort/';
  }
  function modelPaths() {
    return [
      origin + 'models/citrinet/model.int8.onnx',
      origin + 'models/citrinet/sp_pieces.json',
    ];
  }

  function setBase(url) {
    if (url && typeof url === 'string') {
      origin = url.endsWith('/') ? url : url + '/';
    }
  }

  function emitProgress(onProgress, stage, pct) {
    if (typeof onProgress === 'function') {
      try { onProgress({ stage, pct }); } catch (_) {}
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const nodes = document.getElementsByTagName('script');
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].src === src && nodes[i].dataset.mrjReady === '1') {
          resolve();
          return;
        }
      }
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => { s.dataset.mrjReady = '1'; resolve(); };
      s.onerror = () => reject(new Error('failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  function pageResult(result) {
    const doorFail = !!(result && result.doorFail);
    const rawWords = doorFail ? [] : ((result && result.words) || []);
    const words = rawWords.map((w) => ({
      word: w.word,
      score: (Number(w.score) || 0) / 100,
      hint: typeof w.hint === 'string' ? w.hint : '',
    }));
    const score = doorFail ? 0 : (Number(result && result.score) || 0);
    const pass = doorFail ? false : !!(result && result.pass);
    const scorePct = doorFail ? 0 : Math.round(Number(result && result.scorePct) || score * 100);
    return Object.assign({}, result, {
      words,
      overall: { score, band: pass ? 'pass' : 'fail' },
      scorePct,
      pass,
      doorFail,
      reason: (result && result.reason) || '',
      model_id: 'citrinet-trial',
      meta: { scoring_mode: 'citrinet-only' },
    });
  }

  async function load(onProgress) {
    if (booted) {
      const done = await booted;
      emitProgress(onProgress, 'done', 100);
      return done;
    }
    booted = (async () => {
      emitProgress(onProgress, 'download', 8);
      await loadScript(ortSrc());
      emitProgress(onProgress, 'download', 24);
      trialApi = await import(trialSrc());
      emitProgress(onProgress, 'session', 40);
      await trialApi.bootTrialInPage({
        wasmPaths: wasmPaths(),
        paths: modelPaths(),
      });
      emitProgress(onProgress, 'done', 100);
      return true;
    })().catch((e) => { booted = null; trialApi = null; throw e; });
    return booted;
  }

  async function grade(blob, text) {
    await load();
    const decode = global.decodeAudioToMono;
    if (typeof decode !== 'function') throw new Error('decodeAudioToMono is not on the page');
    const samples = await decode(blob, 16000);
    const graded = await trialApi.gradeTrialSamples(samples, text, 60);
    return pageResult(graded.result);
  }

  async function bench(blob, text) {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    await load();
    const decode = global.decodeAudioToMono;
    const samples = await decode(blob, 16000);
    const graded = await trialApi.gradeTrialSamples(samples, text, 60);
    const ms = typeof performance !== 'undefined' ? performance.now() - t0 : 0;
    return {
      ms,
      perf: graded.perf,
      trialMode: 'citrinet-only',
      result: pageResult(graded.result),
    };
  }

  global.MRJPronounce = { setBase, load, grade };
  global.__mrjDecodablePronounceBench = bench;
})(window);
