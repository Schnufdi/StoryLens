// ── narrative/js/ui.js ──
// All UI rendering, event binding, and state-to-DOM logic

const UI = {

  // ── State ──
  currentTab: 'story',
  selectedArc: '3act',
  parsedData: null,
  currentProse: '',
  currentSceneTitle: '',
  isGenerating: false,

  // ── Init ──
  init() {
    this.bindTopbar();
    this.bindSidebar();
    this.bindImport();
    this.bindActionBar();
    this.bindModals();
    this.bindPanel();

    // Load saved state
    const hasSaved = NarrativeApp.load();
    if (hasSaved && NarrativeApp.state.project) {
      this.restoreSession();
    }

    // Check for demo param
    const params = new URLSearchParams(location.search);
    if (params.get('demo') === 'true') {
      setTimeout(() => this.loadDemo(), 300);
    }

    // Load saved API key
    const savedKey = localStorage.getItem('narrative_api_key');
    if (savedKey) {
      NarrativeApp.state.apiKey = savedKey;
      document.getElementById('api-key-input').value = savedKey;
    }
  },

  // ── Topbar bindings ──
  bindTopbar() {
    document.getElementById('btn-settings').addEventListener('click', () => {
      this.openModal('modal-settings');
    });
    document.getElementById('btn-new').addEventListener('click', () => {
      if (confirm('Start a new story? Your current progress is saved in the browser.')) {
        NarrativeApp.clearSave();
      }
    });
    document.getElementById('btn-export-menu').addEventListener('click', () => {
      document.getElementById('export-word-count').textContent = NarrativeExport.wordCount(NarrativeApp).toLocaleString();
      document.getElementById('export-scene-count').textContent = NarrativeExport.sceneCount(NarrativeApp);
      this.openModal('modal-export');
    });
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.id === 'mode-discovery') return;
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  },

  // ── Sidebar bindings ──
  bindSidebar() {
    document.querySelectorAll('.arc-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!NarrativeApp.state.project) return; // only after setup
        document.querySelectorAll('.arc-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedArc = btn.dataset.arc;
        NarrativeApp.initArc(this.selectedArc);
        this.renderSidebar();
        this.renderGeneratePrompt();
      });
    });
  },

  // ── Import bindings ──
  bindImport() {
    document.getElementById('btn-parse').addEventListener('click', () => {
      const text = document.getElementById('outline-input').value.trim();
      if (!text) { showToast('Please paste your story or outline first.', 'error'); return; }
      this.startParse(text);
    });

    document.getElementById('btn-load-demo').addEventListener('click', () => {
      this.loadDemo();
    });
  },

  // ── Load demo story ──
  loadDemo() {
    document.getElementById('outline-input').value = DEMO_STORY.outline;
    this.startParse(DEMO_STORY.outline, DEMO_STORY);
  },

  // ── Start parse flow ──
  async startParse(text, preloaded = null) {
    NarrativeApp.state.rawOutline = text;
    this.openModal('modal-parse');
    document.getElementById('parse-loading').style.display = 'flex';
    document.getElementById('parse-results').style.display = 'none';
    document.getElementById('modal-parse-actions').style.display = 'none';

    // Animate loading steps
    const steps = ['pl-reading', 'pl-chars', 'pl-events', 'pl-threads', 'pl-structure'];
    for (let i = 0; i < steps.length; i++) {
      await this.sleep(preloaded ? 200 : 400);
      document.getElementById(steps[i]).classList.add('done');
    }

    // Parse
    let parsed;
    try {
      if (preloaded) {
        parsed = {
          title: preloaded.title,
          genre: preloaded.genre,
          tone: preloaded.tone,
          pov: preloaded.pov,
          premise: preloaded.premise,
          characters: preloaded.characters,
          themes: preloaded.themes,
          motifs: [],
          openThreads: preloaded.threads,
          structuralSignals: [],
          plotEvents: [],
          centralConflict: '',
        };
      } else {
        parsed = await NarrativeParser.parse(text, NarrativeApp.state.apiKey);
      }
    } catch(e) {
      console.error('Parse error:', e);
      parsed = NarrativeParser.parseHeuristic(text);
    }

    this.parsedData = parsed;
    this.renderParseResults(parsed);

    document.getElementById('parse-loading').style.display = 'none';
    document.getElementById('parse-results').style.display = 'block';
    document.getElementById('modal-parse-actions').style.display = 'flex';
  },

  // ── Render parse results in modal ──
  renderParseResults(parsed) {
    // Fill fields
    document.getElementById('field-title').value = parsed.title || '';
    document.getElementById('field-genre').value = parsed.genre || '';
    document.getElementById('field-tone').value = parsed.tone || '';
    document.getElementById('field-pov').value = parsed.pov || '';
    document.getElementById('field-premise').value = parsed.premise || '';

    // Characters
    const chars = parsed.characters || [];
    document.getElementById('parse-chars-count').textContent = chars.length;
    document.getElementById('parse-chars-list').innerHTML = chars.map(c => `
      <div class="parse-tag">
        <span class="parse-conf conf-${c.confidence || 'high'}"></span>
        ${c.name} <span style="color:var(--ink-ghost);font-weight:400">${c.role}</span>
      </div>
    `).join('');

    // Themes
    const themes = [...(parsed.themes || []), ...(parsed.motifs || [])];
    document.getElementById('parse-themes-count').textContent = themes.length;
    document.getElementById('parse-themes-list').innerHTML = themes.map(t => `
      <div class="parse-tag"><span class="parse-conf conf-med"></span>${t}</div>
    `).join('');

    // Threads
    const threads = parsed.openThreads || [];
    document.getElementById('parse-threads-count').textContent = threads.length;
    document.getElementById('parse-threads-list').innerHTML = threads.map(t => `
      <div class="parse-tag" style="max-width:100%;white-space:normal">
        <span class="parse-conf conf-low"></span>${t}
      </div>
    `).join('');
  },

  // ── Confirm setup and begin writing ──
  confirmSetup() {
    const parsed = this.parsedData;
    if (!parsed) return;

    // Save project
    NarrativeApp.setProject({
      title: document.getElementById('field-title').value || parsed.title || 'Untitled',
      genre: document.getElementById('field-genre').value || parsed.genre || '',
      tone: document.getElementById('field-tone').value || parsed.tone || '',
      pov: document.getElementById('field-pov').value || parsed.pov || '',
      premise: document.getElementById('field-premise').value || parsed.premise || '',
    });

    // Save extracted elements
    NarrativeApp.state.characters = parsed.characters || [];
    NarrativeApp.state.themes = [...(parsed.themes || []), ...(parsed.motifs || [])];
    NarrativeApp.state.threads = parsed.openThreads || [];
    NarrativeApp.state.storyState.currentPOV = parsed.pov || '';

    // Init arc
    const selectedArc = document.querySelector('.arc-option.selected')?.dataset.arc || '3act';
    NarrativeApp.initArc(selectedArc);

    // Map events to clusters
    if (parsed.plotEvents && parsed.plotEvents.length > 0) {
      NarrativeParser.mapToArc(parsed, NarrativeApp.state.clusters);
    }

    this.closeModal('modal-parse');
    this.enterWritingMode();
    NarrativeApp.save();

    showToast('Story structured. Time to write.', 'success');
  },

  // ── Enter writing mode ──
  enterWritingMode() {
    document.getElementById('import-view').classList.add('hidden');
    document.getElementById('writing-view').classList.add('active');
    document.getElementById('action-bar').classList.add('active');
    document.getElementById('btn-export-menu').style.display = '';

    this.updateTopbar();
    this.renderSidebar();
    this.setActiveCluster(0);
    this.renderPanel();
    this.updateStats();
  },

  // ── Restore session ──
  restoreSession() {
    document.getElementById('import-view').classList.add('hidden');
    document.getElementById('writing-view').classList.add('active');
    document.getElementById('action-bar').classList.add('active');
    document.getElementById('btn-export-menu').style.display = '';

    this.updateTopbar();
    this.renderSidebar();
    this.renderAcceptedScenes();

    const activeIdx = NarrativeApp.state.activeClusterIdx;
    this.setActiveCluster(activeIdx, false);
    this.renderPanel();
    this.updateStats();

    showToast('Session restored.', '');
  },

  // ── Update topbar ──
  updateTopbar() {
    const proj = NarrativeApp.state.project;
    if (!proj) return;
    document.getElementById('topbar-project-name').textContent = proj.title || 'Untitled';
    document.getElementById('topbar-breadcrumb').style.display = 'flex';
  },

  // ── Render sidebar cluster list ──
  renderSidebar() {
    const clusters = NarrativeApp.state.clusters;
    const activeIdx = NarrativeApp.state.activeClusterIdx;
    const list = document.getElementById('cluster-list');

    if (!clusters || clusters.length === 0) {
      list.innerHTML = '<div class="empty-state">No clusters yet.</div>';
      return;
    }

    list.innerHTML = clusters.map((c, i) => {
      const sceneCount = c.scenes ? c.scenes.length : 0;
      const acceptedCount = c.scenes ? c.scenes.filter(s => s.status === 'accepted').length : 0;
      return `
        <div class="cluster-item ${i === activeIdx ? 'active' : ''} ${c.status === 'done' ? 'done' : ''}"
             data-cluster-idx="${i}">
          <div class="cluster-dot"></div>
          <div class="cluster-item-text">
            <div class="cluster-item-name">${c.label}</div>
            <div class="cluster-item-fn">${c.fn}</div>
          </div>
          ${sceneCount > 0 ? `<div class="cluster-scene-count">${acceptedCount}/${sceneCount}</div>` : ''}
        </div>
      `;
    }).join('');

    list.querySelectorAll('.cluster-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.clusterIdx);
        this.setActiveCluster(idx);
      });
    });
  },

  // ── Set active cluster ──
  setActiveCluster(idx, generate = false) {
    NarrativeApp.setActiveCluster(idx);
    this.renderSidebar();
    this.renderGeneratePrompt();
    this.updateTopbarBreadcrumb();

    // Update next hint
    this.updateNextHint();

    // If cluster has a current draft prose, show it
    const cluster = NarrativeApp.activeCluster;
    if (!cluster) return;
    if (this.currentProse && generate) {
      // keep showing current prose
    } else if (!generate) {
      this.showGenerateReady();
    }
  },

  // ── Show "ready to generate" state ──
  showGenerateReady() {
    const cluster = NarrativeApp.activeCluster;
    if (!cluster) return;

    document.getElementById('scene-header').style.display = 'block';
    document.getElementById('scene-location').textContent = `${cluster.label}`;
    document.getElementById('scene-title').textContent = cluster.fn;
    document.getElementById('scene-fn-badge').innerHTML = `<span class="pill pill-accent">${cluster.emotional}</span>`;

    document.getElementById('generate-prompt').style.display = 'block';
    document.getElementById('gen-cluster-title').textContent = `${cluster.label}: ${cluster.fn}`;
    document.getElementById('gen-cluster-desc').textContent =
      `Emotional register: ${cluster.emotional} · Pacing: ${cluster.pacing}`;

    // Show extracted events if any
    if (cluster.extractedEvents && cluster.extractedEvents.length > 0) {
      document.getElementById('gen-cluster-events').style.display = 'block';
      document.getElementById('gen-events-list').innerHTML = cluster.extractedEvents.map(e =>
        `<div class="thread-pill">${e.substring(0, 80)}${e.length > 80 ? '…' : ''}</div>`
      ).join('');
    }

    document.getElementById('generating-overlay').classList.remove('active');
    document.getElementById('prose-block').style.display = 'none';
    document.getElementById('btn-accept').style.display = 'none';
    document.getElementById('btn-regenerate').style.display = 'none';
    document.getElementById('btn-continue-gen').style.display = 'none';
    this.currentProse = '';
    this.currentSceneTitle = '';
  },

  // ── Render generate prompt (called when cluster changes) ──
  renderGeneratePrompt() {
    const cluster = NarrativeApp.activeCluster;
    if (!cluster) return;
    this.showGenerateReady();
  },

  // ── Generate scene ──
  async generateScene() {
    if (this.isGenerating) return;
    this.isGenerating = true;

    const hint = document.getElementById('scene-hint-input').value;

    // Show generating state
    document.getElementById('generate-prompt').style.display = 'none';
    document.getElementById('prose-block').style.display = 'none';
    document.getElementById('generating-overlay').classList.add('active');
    document.getElementById('btn-accept').style.display = 'none';
    document.getElementById('btn-regenerate').style.display = 'none';

    const loadingMessages = [
      'Writing the scene…',
      'Finding the voice…',
      'Following the thread…',
      'Shaping the moment…',
    ];
    let msgIdx = 0;
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % loadingMessages.length;
      document.getElementById('generating-text').textContent = loadingMessages[msgIdx];
    }, 2000);

    try {
      const prose = await NarrativeWriter.generate(NarrativeApp, hint);
      this.currentProse = prose;
      this.currentSceneTitle = NarrativeWriter.suggestTitle(prose, NarrativeApp.activeCluster?.label || 'Scene');

      clearInterval(msgInterval);
      this.showGeneratedProse(prose);
    } catch(e) {
      clearInterval(msgInterval);
      document.getElementById('generating-overlay').classList.remove('active');
      document.getElementById('generate-prompt').style.display = 'block';
      showToast(`Generation failed: ${e.message}`, 'error');
      console.error(e);
    } finally {
      this.isGenerating = false;
    }
  },

  // ── Show generated prose ──
  showGeneratedProse(prose) {
    document.getElementById('generating-overlay').classList.remove('active');

    const proseEl = document.getElementById('prose-content');
    const paragraphs = prose.split('\n').filter(p => p.trim());
    proseEl.innerHTML = paragraphs.map((p, i) =>
      i === paragraphs.length - 1
        ? `<p>${p} <span class="prose-cursor"></span></p>`
        : `<p>${p}</p>`
    ).join('');

    document.getElementById('prose-block').style.display = 'block';
    document.getElementById('btn-accept').style.display = 'inline-flex';
    document.getElementById('btn-regenerate').style.display = 'inline-flex';
    document.getElementById('btn-continue-gen').style.display = 'inline-flex';

    // Update topbar scene name
    document.getElementById('topbar-scene').textContent = this.currentSceneTitle;

    // Scroll to top of prose
    document.getElementById('workspace-scroll').scrollTop = document.getElementById('scene-content').offsetTop;
  },

  // ── Accept scene ──
  acceptScene() {
    if (!this.currentProse) return;
    const cluster = NarrativeApp.activeCluster;
    if (!cluster) return;

    const scene = NarrativeApp.addScene(NarrativeApp.state.activeClusterIdx, {
      title: this.currentSceneTitle,
      prose: this.currentProse,
      fn: cluster.fn,
      pov: NarrativeApp.state.project?.pov || '',
    });

    NarrativeApp.acceptScene(cluster.id, scene.id);
    NarrativeWriter.updateStateFromScene(this.currentProse, NarrativeApp);

    // Add to accepted list
    this.renderAcceptedScenes();

    // Clear active prose
    this.currentProse = '';
    this.currentSceneTitle = '';

    this.renderSidebar();
    this.updateStats();
    showToast('Scene accepted.', 'success');

    // Auto-advance if this was the last accepted in cluster and there's a next
    this.showGenerateReady();
    this.updateNextHint();
  },

  // ── Render all accepted scenes in writing view ──
  renderAcceptedScenes() {
    const list = document.getElementById('accepted-scenes-list');
    const allAccepted = NarrativeApp.getAllAcceptedProse();

    if (allAccepted.length === 0) {
      list.innerHTML = '';
      return;
    }

    list.innerHTML = allAccepted.map(({ cluster, scene }) => {
      const paragraphs = scene.prose.split('\n').filter(p => p.trim())
        .map(p => `<p>${p}</p>`).join('');
      return `
        <div class="scene-card" id="card-${scene.id}">
          <div class="scene-card-header">
            <div class="scene-card-title">${cluster} · ${scene.title}</div>
            <div class="scene-card-status">Accepted</div>
          </div>
          <div class="scene-card-prose">${paragraphs}</div>
        </div>
      `;
    }).join('');
  },

  // ── Update next scene hint ──
  updateNextHint() {
    const idx = NarrativeApp.state.activeClusterIdx;
    const clusters = NarrativeApp.state.clusters;
    const next = clusters[idx + 1];
    const hint = document.getElementById('next-scene-hint');
    const label = document.getElementById('next-cluster-label');
    if (next) {
      hint.style.display = 'flex';
      label.textContent = `${next.label} — ${next.fn}`;
    } else {
      hint.style.display = 'none';
    }
  },

  // ── Update topbar breadcrumb ──
  updateTopbarBreadcrumb() {
    const cluster = NarrativeApp.activeCluster;
    document.getElementById('topbar-cluster').textContent = cluster?.label || '—';
    document.getElementById('topbar-scene').textContent = this.currentSceneTitle || '—';
  },

  // ── Update word/scene stats ──
  updateStats() {
    const words = NarrativeExport.wordCount(NarrativeApp);
    const scenes = NarrativeExport.sceneCount(NarrativeApp);
    document.getElementById('stat-words').textContent = `${words.toLocaleString()} words`;
    document.getElementById('stat-scenes').textContent = `${scenes} scene${scenes !== 1 ? 's' : ''}`;
  },

  // ── Action bar bindings ──
  bindActionBar() {
    document.getElementById('btn-generate').addEventListener('click', () => this.generateScene());

    document.getElementById('btn-accept').addEventListener('click', () => this.acceptScene());

    document.getElementById('btn-regenerate').addEventListener('click', () => {
      document.getElementById('prose-block').style.display = 'none';
      document.getElementById('btn-accept').style.display = 'none';
      document.getElementById('btn-regenerate').style.display = 'none';
      document.getElementById('btn-continue-gen').style.display = 'none';
      this.generateScene();
    });

    document.getElementById('btn-continue-gen').addEventListener('click', () => {
      // Append to existing prose
      const extra = ` The scene continued, deeper into the exchange, finding the rhythm of what was actually happening beneath the surface.`;
      const proseEl = document.getElementById('prose-content');
      const lastP = proseEl.querySelector('p:last-child');
      if (lastP) {
        lastP.innerHTML = lastP.innerHTML.replace('<span class="prose-cursor"></span>', '') + extra + ' <span class="prose-cursor"></span>';
      }
    });

    // Recalibration buttons
    document.querySelectorAll('.recal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.recal;
        if (key === 'custom-dir') {
          document.getElementById('custom-dir-row').classList.toggle('active');
          return;
        }
        btn.classList.toggle('active');
        if (NarrativeWriter.activeRecal.has(key)) {
          NarrativeWriter.activeRecal.delete(key);
        } else {
          NarrativeWriter.activeRecal.add(key);
        }
      });
    });

    document.getElementById('btn-apply-custom').addEventListener('click', () => {
      NarrativeWriter.customDirection = document.getElementById('custom-dir-input').value;
      document.getElementById('custom-dir-row').classList.remove('active');
      if (this.currentProse) {
        // Regenerate with custom direction
        document.getElementById('prose-block').style.display = 'none';
        document.getElementById('btn-accept').style.display = 'none';
        document.getElementById('btn-regenerate').style.display = 'none';
        this.generateScene();
      }
      showToast('Custom direction applied.', '');
    });

    document.getElementById('btn-clear-custom').addEventListener('click', () => {
      document.getElementById('custom-dir-input').value = '';
      NarrativeWriter.customDirection = '';
      document.getElementById('custom-dir-row').classList.remove('active');
    });
  },

  // ── Panel bindings ──
  bindPanel() {
    document.querySelectorAll('.panel-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentTab = tab.dataset.tab;
        this.renderPanel();
      });
    });
  },

  // ── Render right panel ──
  renderPanel() {
    const content = document.getElementById('panel-content');
    if (!NarrativeApp.state.project) {
      content.innerHTML = '<div class="empty-state">Import your story to see extracted elements.</div>';
      return;
    }

    if (this.currentTab === 'story') this.renderStoryPanel(content);
    else if (this.currentTab === 'characters') this.renderCharactersPanel(content);
    else if (this.currentTab === 'state') this.renderStatePanel(content);
  },

  renderStoryPanel(content) {
    const proj = NarrativeApp.state.project;
    const themes = NarrativeApp.state.themes;
    const threads = NarrativeApp.state.threads;
    const cluster = NarrativeApp.activeCluster;

    content.innerHTML = `
      <div class="panel-section">
        <div class="panel-section-title">This cluster</div>
        ${cluster ? `
          <div class="panel-item">
            <div class="panel-item-dot"></div>
            <div class="panel-item-text">
              <div class="panel-item-label">${cluster.fn}</div>
              ${cluster.emotional} · ${cluster.pacing} pacing
            </div>
          </div>
        ` : '<div class="empty-state" style="padding:8px 0;font-size:0.8rem">No cluster selected</div>'}
      </div>

      <div class="panel-section">
        <div class="panel-section-title">Themes</div>
        <div>${themes.map(t => `<span class="thread-pill">${t}</span>`).join('')}</div>
      </div>

      <div class="panel-section">
        <div class="panel-section-title">Open threads</div>
        ${threads.length > 0
          ? threads.map(t => `
            <div class="panel-item">
              <div class="panel-item-dot ghost"></div>
              <div class="panel-item-text">${t}</div>
            </div>
          `).join('')
          : '<div class="empty-state" style="padding:8px 0;font-size:0.8rem">No threads extracted yet</div>'
        }
      </div>

      <div class="panel-section">
        <div class="panel-section-title">Story</div>
        <div class="panel-item">
          <div class="panel-item-dot teal"></div>
          <div class="panel-item-text"><span class="panel-item-label">Genre</span> ${proj.genre || '—'}</div>
        </div>
        <div class="panel-item">
          <div class="panel-item-dot teal"></div>
          <div class="panel-item-text"><span class="panel-item-label">Tone</span> ${proj.tone || '—'}</div>
        </div>
        <div class="panel-item">
          <div class="panel-item-dot teal"></div>
          <div class="panel-item-text"><span class="panel-item-label">POV</span> ${proj.pov || '—'}</div>
        </div>
      </div>
    `;
  },

  renderCharactersPanel(content) {
    const chars = NarrativeApp.state.characters;
    if (!chars || chars.length === 0) {
      content.innerHTML = '<div class="empty-state">No characters extracted yet.</div>';
      return;
    }
    content.innerHTML = `
      <div class="panel-section">
        <div class="panel-section-title">Characters</div>
        ${chars.map(c => `
          <div class="char-card">
            <div class="char-name">${c.name}</div>
            <div class="char-role">${c.role}</div>
            <div class="char-row">
              <div class="char-key">Want</div>
              <div class="char-val">${c.want || '—'}</div>
            </div>
            <div class="char-row">
              <div class="char-key">Fear</div>
              <div class="char-val">${c.fear || '—'}</div>
            </div>
            ${c.arc ? `
            <div class="char-row">
              <div class="char-key">Arc</div>
              <div class="char-val">${c.arc}</div>
            </div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  },

  renderStatePanel(content) {
    const state = NarrativeApp.state.storyState;
    const written = state.written || [];
    const cluster = NarrativeApp.activeCluster;

    content.innerHTML = `
      <div class="panel-section">
        <div class="panel-section-title">Current position</div>
        <div class="panel-item">
          <div class="panel-item-dot"></div>
          <div class="panel-item-text">
            <span class="panel-item-label">${cluster?.label || '—'}</span>
            ${cluster?.fn || ''}
          </div>
        </div>
        ${state.currentPOV ? `
        <div class="panel-item">
          <div class="panel-item-dot teal"></div>
          <div class="panel-item-text"><span class="panel-item-label">POV</span> ${state.currentPOV}</div>
        </div>` : ''}
        ${state.toneState ? `
        <div class="panel-item">
          <div class="panel-item-dot gold"></div>
          <div class="panel-item-text"><span class="panel-item-label">Tone</span> ${state.toneState}</div>
        </div>` : ''}
      </div>

      <div class="panel-section">
        <div class="panel-section-title">Progress</div>
        <div class="panel-item">
          <div class="panel-item-dot teal"></div>
          <div class="panel-item-text">${written.length} scene${written.length !== 1 ? 's' : ''} accepted</div>
        </div>
        <div class="panel-item">
          <div class="panel-item-dot teal"></div>
          <div class="panel-item-text">${NarrativeExport.wordCount(NarrativeApp).toLocaleString()} words written</div>
        </div>
      </div>

      <div class="panel-section">
        <div class="panel-section-title">Arc alignment</div>
        <div class="panel-item">
          <div class="panel-item-dot ${cluster?.status === 'done' ? 'teal' : ''}"></div>
          <div class="panel-item-text">
            ${cluster?.status === 'done' ? 'Cluster complete — advance to next' :
              cluster?.status === 'active' ? 'Actively writing this cluster' :
              'Cluster not yet started'}
          </div>
        </div>
      </div>
    `;
  },

  // ── Modal bindings ──
  bindModals() {
    // Parse modal
    document.getElementById('btn-modal-confirm').addEventListener('click', () => this.confirmSetup());
    document.getElementById('btn-modal-cancel').addEventListener('click', () => this.closeModal('modal-parse'));

    // Arc options in parse modal
    document.querySelectorAll('.arc-option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.arc-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
      });
    });

    // Settings modal
    document.getElementById('btn-settings-save').addEventListener('click', () => {
      const key = document.getElementById('api-key-input').value.trim();
      NarrativeApp.state.apiKey = key || null;
      if (key) localStorage.setItem('narrative_api_key', key);
      else localStorage.removeItem('narrative_api_key');
      this.closeModal('modal-settings');
      showToast(key ? 'API key saved. AI generation enabled.' : 'API key cleared. Running in demo mode.', 'success');
    });
    document.getElementById('btn-settings-cancel').addEventListener('click', () => this.closeModal('modal-settings'));

    // Export modal
    document.getElementById('btn-export-txt').addEventListener('click', () => {
      NarrativeExport.exportText(NarrativeApp);
      this.closeModal('modal-export');
    });
    document.getElementById('btn-export-html').addEventListener('click', () => {
      NarrativeExport.exportHTML(NarrativeApp);
      this.closeModal('modal-export');
    });
    document.getElementById('btn-export-cancel').addEventListener('click', () => this.closeModal('modal-export'));

    // Close on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeModal(overlay.id);
      });
    });

    // Escape to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => this.closeModal(m.id));
      }
    });
  },

  openModal(id) {
    document.getElementById(id)?.classList.add('active');
  },

  closeModal(id) {
    document.getElementById(id)?.classList.remove('active');
  },

  // ── Helpers ──
  sleep(ms) { return new Promise(r => setTimeout(r, ms)); },
};

// ── Boot ──
document.addEventListener('DOMContentLoaded', () => UI.init());
