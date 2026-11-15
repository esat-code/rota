// In the desktop app, infer locally from bundled files without file:// fetches.
// HTTP previews continue using the ordinary MediaPipe fileset and fetch loader.
const MAX_ASSET_BYTES = 15 * 1024 * 1024;
const NATIVE_ASSETS = {
  loader: ['vision_wasm_nosimd_internal.js', 'text/javascript'],
  binary: ['vision_wasm_nosimd_internal.wasm', 'application/wasm'],
  model: ['pose_landmarker_lite.task', 'application/octet-stream'],
};
let preparation;
const activeBlobURLs = new Set();

function reader() {
  if (typeof window === 'undefined') return null;
  if(window.location.protocol!=='file:'&&new URL(document.baseURI).protocol!=='file:')return null;
  try {
    const owner = typeof window.parent?.rotaSportReadAsset === 'function' ? window.parent : window;
    return typeof owner.rotaSportReadAsset === 'function' ? owner.rotaSportReadAsset.bind(owner) : null;
  } catch { return null; }
}

function decodeAsset(result, filename) {
  const base64 = typeof result === 'string' ? result : result?.base64;
  if (typeof base64 !== 'string' || !base64.length || base64.length > Math.ceil(MAX_ASSET_BYTES / 3) * 4 + 4) {
    throw Error(`Spor analiz dosyası alınamadı: ${filename}`);
  }
  let decoded;
  try { decoded = atob(base64); }
  catch { throw Error(`Spor analiz dosyası okunamadı: ${filename}`); }
  if (!decoded.length || decoded.length > MAX_ASSET_BYTES) throw Error('Spor analiz dosyasının boyutu geçersiz.');
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  if (filename.endsWith('.wasm') && (bytes[0] !== 0 || bytes[1] !== 97 || bytes[2] !== 115 || bytes[3] !== 109)) {
    throw Error('Spor analiz motoru okunamadı.');
  }
  return bytes;
}

function blobURL(bytes, mimeType) {
  const url = URL.createObjectURL(new Blob([bytes], {type: mimeType}));
  activeBlobURLs.add(url);
  return url;
}

/**
 * null for HTTP/non-native previews; otherwise a MediaPipe WasmFileset plus
 * model bytes. The no-SIMD CPU build also supports older Intel/WebKit versions.
 * Pass paths to createFromOptions and modelAssetBuffer to its baseOptions.
 */
export async function prepareNativePoseAssets() {
  const read = reader();
  if (!read) return null;
  if (!preparation) {
    preparation = (async () => {
      const entries = await Promise.all(Object.entries(NATIVE_ASSETS).map(async ([key, [name, mime]]) => {
        return [key, {bytes: decodeAsset(await read(name), name), mime}];
      }));
      const assets = Object.fromEntries(entries);
      return {
        wasmLoaderPath: blobURL(assets.loader.bytes, assets.loader.mime),
        wasmBinaryPath: blobURL(assets.binary.bytes, assets.binary.mime),
        modelAssetBuffer: assets.model.bytes,
      };
    })().catch(error => { preparation = undefined; throw error; });
  }
  return preparation;
}

if (typeof window !== 'undefined') window.addEventListener('pagehide', event => {
  // A page in the back/forward cache may be restored with its prepared fileset.
  if (event.persisted) return;
  for (const url of activeBlobURLs) URL.revokeObjectURL(url);
  activeBlobURLs.clear();
  preparation = undefined;
});
