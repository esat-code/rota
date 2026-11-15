import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import 'pdfjs-dist/legacy/build/pdf.worker.mjs';

window.rotaNotesPDF = data => getDocument({
  data,
  isEvalSupported: false,
  enableXfa: false,
  useSystemFonts: true,
  useWasm: false,
}).promise;
