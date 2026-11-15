// Short, locally synthesized interface clicks. No network or recorded assets.
const patterns = {
  press: [[500,350,.045,1,0,'sine']],
  enter: [[440,580,.06,.7,0,'sine'],[730,660,.07,.45,.045,'sine']],
  navigate: [[360,480,.055,.6,0,'sine'],[600,700,.06,.4,.035,'sine']],
  back: [[510,410,.05,.65,0,'sine'],[360,300,.05,.35,.025,'sine']],
  panel: [[330,260,.04,.75,0,'triangle'],[650,500,.03,.2,.027,'sine']],
  select: [[580,490,.035,.65,0,'sine']],
  save: [[520,590,.055,.65,0,'sine'],[780,780,.07,.35,.035,'sine']],
  discard: [[230,150,.065,.7,0,'triangle']],
  exit: [[270,180,.08,.7,0,'sine']],
  check: [[820,510,.03,.6,0,'sine']],
  uncheck: [[490,270,.035,.55,0,'sine']],
  'toggle-on': [[420,640,.05,.7,0,'sine']],
  'toggle-off': [[570,360,.05,.6,0,'sine']],
};
function soundKind(button) {
  if (button.dataset.uiSound) return button.dataset.uiSound;
  const id = button.id;
  if (id === 'password-toggle') return 'none';
  if (id === 'entry-submit') return 'enter';
  if (id === 'open-hafizlik') return 'navigate';
  if (id === 'save-and-exit') return 'back';
  if (['app-exit','exit-confirm'].includes(id)) return 'exit';
  if (id === 'settings-save') return 'save';
  if (id === 'password-remove' || button.matches('.timer-delete, [data-action="delete"]')) return 'discard';
  if (button.dataset.action === 'reset') return 'back';
  if (['menu','details'].includes(button.dataset.action)) return 'panel';
  if (button.dataset.action === 'toggle') return button.textContent.includes('Duraklat') ? 'toggle-off' : 'toggle-on';
  if (button.value === 'start') return 'enter';
  if (button.matches('input[type="checkbox"]')) return button.checked ? 'check' : 'uncheck';
  if (button.getAttribute('role') === 'switch') return button.getAttribute('aria-checked') === 'true' ? 'toggle-off' : 'toggle-on';
  if (id === 'sound-toggle') return button.getAttribute('aria-pressed') === 'true' ? 'toggle-off' : 'toggle-on';
  if (id.includes('close') || id === 'exit-cancel' || button.matches('.settings-menu-back')) return 'back';
  if (id === 'settings-open' || id === 'open-timers') return 'panel';
  if (id.startsWith('settings-')) return 'select';
  return 'press';
}
export function createButtonSounds({document: doc = document, readVolume = () => .35} = {}) {
  const view = doc.defaultView;
  let context = null, disposed = false;
  function play(kind = 'press') {
    if (kind === 'none') return;
    const value = Number(readVolume());
    const volume = Number.isFinite(value) ? Math.max(0,Math.min(1,value)) : .35;
    if (disposed || volume === 0 || doc.hidden) return;
    try {
      const Context = view.AudioContext || view.webkitAudioContext;
      if (!Context) return;
      context ||= new Context();
      if (context.state === 'suspended') void context.resume().catch(() => {});
      const at = context.currentTime;
      for (const [from,to,length,weight,delay,type] of patterns[kind] || patterns.press) {
        const start = at + delay;
        const tone = context.createOscillator();
        const gain = context.createGain();
        tone.type = type;
        tone.frequency.setValueAtTime(from, start);
        tone.frequency.exponentialRampToValueAtTime(to, start + length);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(volume * .12 * weight, start + .003);
        gain.gain.exponentialRampToValueAtTime(.0001, start + length);
        tone.connect(gain);
        gain.connect(context.destination);
        tone.onended = () => { tone.disconnect(); gain.disconnect(); };
        tone.start(start);
        tone.stop(start + length + .005);
      }
    } catch { /* Interface controls keep working if sound is unavailable. */ }
  }
  const target = event => event.target?.closest?.('button,[role="button"],[role="switch"],input[type="checkbox"],summary');
  function click(event) {
    const button = target(event);
    if (event.isTrusted && button && !button.disabled && button.getAttribute('aria-disabled') !== 'true') play(soundKind(button));
  }
  function keyboard(event) {
    const button = target(event);
    if (event.isTrusted && !event.repeat && ['Enter',' '].includes(event.key) && button?.getAttribute('role') === 'button' && button.tagName !== 'BUTTON') play(soundKind(button));
  }
  doc.addEventListener('click', click, true);
  doc.addEventListener('keydown', keyboard, true);
  return {play, dispose() {
    if (disposed) return;
    disposed = true;
    doc.removeEventListener('click',click,true);
    doc.removeEventListener('keydown',keyboard,true);
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }};
}
