import offlineManifest from './offline-video-manifest.json' with {type:'json'};

export function videoInfo(raw) {
  try {
    const url = new URL(raw);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    let id;
    if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0];
    if (['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(host)) {
      id = url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).at(-1);
    }
    if (id && /^[\w-]{11}$/.test(id)) {
      return {kind: 'youtube', id, src: 'https://www.youtube-nocookie.com/embed/' + id + '?playsinline=1&rel=0', original: url.href};
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const match = url.pathname.match(/(?:\/video)?\/(\d+)(?:\/|$)/);
      if (match) return {kind: 'embed', src: 'https://player.vimeo.com/video/' + match[1], original: url.href};
    }
    return {kind: /\.(mp4|webm|mov)(?:$|\?)/i.test(url.href) ? 'file' : 'link', src: url.href, original: url.href};
  } catch { return null; }
}
export function nativeVideoAvailable() {
  try { return window.parent !== window && typeof window.parent.rotaSportPlayVideo === 'function'; }
  catch { return false; }
}
// Resolve only verified bundled assets, without rewriting library records or
// day bindings. A user-selected local file always takes precedence over a URL.
export function offlineVideo(video) {
  if (!video || video.local) return null;
  const info=videoInfo(video.url);
  if (info?.kind!=='youtube' || !Object.hasOwn(offlineManifest.youtube,info.id)) return null;
  const cached=offlineManifest.youtube[info.id];
  if (cached.file!=='yt-'+info.id+'.mp4') return null;
  return {...cached,src:'./assets/offline-videos/'+cached.file};
}
export async function playNativeVideo(video) {
  if (!video || video.local || offlineVideo(video)) return false;
  const info = videoInfo(video?.url);
  if (info?.kind !== 'youtube' || !nativeVideoAvailable()) return false;
  await window.parent.rotaSportPlayVideo({videoID: info.id, title: video.title || 'Videom'});
  return true;
}

