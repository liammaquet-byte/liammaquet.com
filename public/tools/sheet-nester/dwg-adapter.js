// Sheet Nester DWG bridge — MIT licensed as part of Sheet Nester.
// The GPL-licensed LibreDWG parser runs only in the separate module worker.
let seq = 0;

export function parseDwgFile(arrayBuffer, name) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const worker = new Worker('./dwg-worker.js', {type:'module'});
    const finish = () => worker.terminate();
    worker.onmessage = (event) => {
      const m = event.data || {};
      if (m.id !== id) return;
      finish();
      if (m.ok) resolve(m.result);
      else reject(new Error(m.error || 'DWG decoder failed.'));
    };
    worker.onerror = (event) => {
      finish();
      reject(new Error(event.message || 'DWG decoder worker failed to start.'));
    };
    // Transfer rather than copy the drawing buffer. It remains local to the browser.
    worker.postMessage({id, arrayBuffer, name}, [arrayBuffer]);
  });
}
