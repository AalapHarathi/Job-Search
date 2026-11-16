// Client-side text extraction. The file never leaves the browser except into
// your own Firestore document (Security Rules restrict it to your account).

export async function extractText(file: File): Promise<{ text: string; type: 'pdf' | 'docx' }> {
  const name = file.name.toLowerCase();
  const buf = await file.arrayBuffer();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const pdfjs = await import('pdfjs-dist');
    const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = worker;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let line = '';
      const lines: string[] = [];
      for (const item of content.items) {
        if (!('str' in item)) continue;
        line += item.str;
        if (item.hasEOL) { lines.push(line); line = ''; }
        else if (item.str && !item.str.endsWith(' ')) line += ' ';
      }
      if (line.trim()) lines.push(line);
      pages.push(lines.map((l) => l.replace(/\s+/g, ' ').trim()).join('\n'));
    }
    const text = pages.join('\n\n').trim();
    if (text.length < 80) throw new Error('This PDF has almost no selectable text (it may be a scanned image). Upload a text-based PDF or a DOCX.');
    return { text, type: 'pdf' };
  }
  if (name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = await import('mammoth/mammoth.browser.js');
    const res = await mammoth.extractRawText({ arrayBuffer: buf });
    const text = res.value.replace(/\n{3,}/g, '\n\n').trim();
    if (text.length < 80) throw new Error('Couldn’t read text from this document.');
    return { text, type: 'docx' };
  }
  throw new Error('Upload a PDF or DOCX file.');
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });
}
