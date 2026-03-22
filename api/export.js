// ── narrative/js/export.js ──
// Export accepted scenes to text file or formatted document

const NarrativeExport = {

  // ── Export as plain text ──
  exportText(app) {
    const prose = app.getAllAcceptedProse();
    if (prose.length === 0) {
      showToast('No accepted scenes to export yet.', 'error');
      return;
    }

    const proj = app.state.project;
    let output = '';

    // Title block
    output += `${proj.title || 'Untitled'}\n`;
    output += `${'─'.repeat(60)}\n\n`;
    if (proj.premise) output += `${proj.premise}\n\n`;
    output += `${'─'.repeat(60)}\n\n`;

    // Scenes grouped by cluster
    let currentCluster = null;
    for (const { cluster, scene } of prose) {
      if (cluster !== currentCluster) {
        output += `\n\n${'═'.repeat(40)}\n${cluster.toUpperCase()}\n${'═'.repeat(40)}\n\n`;
        currentCluster = cluster;
      }
      output += `${scene.title}\n${'─'.repeat(scene.title.length)}\n\n`;
      output += `${scene.prose}\n\n`;
    }

    // Download
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(proj.title || 'narrative').toLowerCase().replace(/\s+/g, '-')}-draft.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Exported ${prose.length} scene${prose.length > 1 ? 's' : ''} as text file.`, 'success');
  },

  // ── Export as HTML (readable, printable) ──
  exportHTML(app) {
    const prose = app.getAllAcceptedProse();
    if (prose.length === 0) {
      showToast('No accepted scenes to export yet.', 'error');
      return;
    }

    const proj = app.state.project;
    let scenes = '';

    let currentCluster = null;
    for (const { cluster, scene } of prose) {
      if (cluster !== currentCluster) {
        scenes += `<div class="act-break"><span>${cluster}</span></div>`;
        currentCluster = cluster;
      }
      const paragraphs = scene.prose.split('\n').filter(p => p.trim())
        .map(p => `<p>${p.trim()}</p>`).join('');
      scenes += `<div class="scene"><h3>${scene.title}</h3>${paragraphs}</div>`;
    }

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${proj.title || 'Narrative draft'}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 13pt; line-height: 2; color: #1a1814; background: #f7f4ef; padding: 0; }
  .cover { text-align: center; padding: 4in 1in; page-break-after: always; }
  .cover h1 { font-size: 2.5rem; font-weight: 300; letter-spacing: -0.02em; }
  .cover p { color: #7a7568; margin-top: 12px; font-size: 1rem; }
  .content { max-width: 640px; margin: 0 auto; padding: 2in 1in; }
  .act-break { text-align: center; margin: 60px 0 40px; }
  .act-break span { font-size: 0.7rem; letter-spacing: 0.15em; text-transform: uppercase; color: #b8b3a8; background: #f7f4ef; padding: 0 16px; position: relative; }
  .act-break::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: #ddd; }
  .scene { margin-bottom: 60px; page-break-inside: avoid; }
  .scene h3 { font-size: 1.2rem; font-weight: 400; font-style: italic; color: #c4622d; margin-bottom: 20px; }
  p { margin-bottom: 1.2em; text-indent: 2em; }
  p:first-of-type { text-indent: 0; }
  @media print {
    body { background: white; }
    .content { padding: 0.75in; }
  }
</style>
</head>
<body>
<div class="cover">
  <h1>${proj.title || 'Untitled'}</h1>
  ${proj.genre ? `<p>${proj.genre}</p>` : ''}
</div>
<div class="content">
${scenes}
</div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(proj.title || 'narrative').toLowerCase().replace(/\s+/g, '-')}-draft.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Exported ${prose.length} scene${prose.length > 1 ? 's' : ''} as readable HTML.`, 'success');
  },

  // ── Word count ──
  wordCount(app) {
    const prose = app.getAllAcceptedProse();
    const total = prose.reduce((sum, { scene }) => {
      return sum + (scene.prose.split(/\s+/).filter(Boolean).length);
    }, 0);
    return total;
  },

  // ── Scene count ──
  sceneCount(app) {
    return app.getAllAcceptedProse().length;
  }
};

window.NarrativeExport = NarrativeExport;
