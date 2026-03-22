// ── narrative/js/app.js ──
// Core state, storage, and story management

const NarrativeApp = {

  // ── State ──
  state: {
    project: null,       // current project metadata
    characters: [],      // extracted characters
    themes: [],          // extracted themes
    threads: [],         // open threads
    clusters: [],        // structural clusters (acts/blocks)
    scenes: [],          // all scenes across clusters
    storyState: {        // live story state
      written: [],       // accepted scene IDs
      tensions: [],
      motifs: [],
      currentPOV: null,
      currentLocation: null,
      toneState: null,
    },
    activeClusterIdx: 0,
    activeSceneIdx: 0,
    arcType: '3act',     // '3act' | '5part' | 'custom'
    rawOutline: '',
    apiKey: null,
  },

  // ── Storage ──
  save() {
    try {
      localStorage.setItem('narrative_state', JSON.stringify(this.state));
    } catch(e) { console.warn('Save failed:', e); }
  },

  load() {
    try {
      const saved = localStorage.getItem('narrative_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.assign(this.state, parsed);
        return true;
      }
    } catch(e) { console.warn('Load failed:', e); }
    return false;
  },

  clearSave() {
    localStorage.removeItem('narrative_state');
    location.reload();
  },

  // ── Arc templates ──
  arcTemplates: {
    '3act': {
      label: 'Three-act structure',
      clusters: [
        { id: 'act1',     label: 'Act 1',          fn: 'Setup',           emotional: 'Establishment', pacing: 'measured' },
        { id: 'act2a',    label: 'Act 2A',          fn: 'Rising conflict', emotional: 'Escalation',    pacing: 'building' },
        { id: 'midpoint', label: 'Midpoint',        fn: 'Pivot',          emotional: 'Reversal',       pacing: 'sharp' },
        { id: 'act2b',    label: 'Act 2B',          fn: 'Complication',   emotional: 'Crisis build',   pacing: 'urgent' },
        { id: 'crisis',   label: 'Crisis',          fn: 'Darkest moment', emotional: 'Collapse',       pacing: 'compressed' },
        { id: 'climax',   label: 'Climax',          fn: 'Confrontation',  emotional: 'Peak tension',   pacing: 'relentless' },
        { id: 'res',      label: 'Resolution',      fn: 'New equilibrium',emotional: 'Release',        pacing: 'slowing' },
      ]
    },
    '5part': {
      label: 'Five-part dramatic arc',
      clusters: [
        { id: 'exp',    label: 'Exposition',     fn: 'World and character', emotional: 'Grounding',    pacing: 'open' },
        { id: 'rise',   label: 'Rising action',  fn: 'Destabilisation',    emotional: 'Unease',       pacing: 'building' },
        { id: 'climax', label: 'Climax',         fn: 'Peak conflict',       emotional: 'Maximum',      pacing: 'relentless' },
        { id: 'fall',   label: 'Falling action', fn: 'Consequences',        emotional: 'Exhaustion',   pacing: 'easing' },
        { id: 'cat',    label: 'Denouement',     fn: 'Resolution',          emotional: 'Clarity',      pacing: 'still' },
      ]
    },
    'custom': {
      label: 'Custom structure',
      clusters: [
        { id: 'c1', label: 'Opening',  fn: 'Define', emotional: 'Establish', pacing: 'open' },
        { id: 'c2', label: 'Middle',   fn: 'Develop',emotional: 'Escalate',  pacing: 'building' },
        { id: 'c3', label: 'Closing',  fn: 'Resolve',emotional: 'Release',   pacing: 'still' },
      ]
    }
  },

  // ── Initialise arc from template ──
  initArc(arcType) {
    const template = this.arcTemplates[arcType];
    if (!template) return;
    this.state.arcType = arcType;
    this.state.clusters = template.clusters.map((c, i) => ({
      ...c,
      scenes: [],
      status: 'unwritten', // 'unwritten' | 'active' | 'done'
      idx: i,
    }));
    this.state.activeClusterIdx = 0;
    this.save();
  },

  // ── Get active cluster ──
  get activeCluster() {
    return this.state.clusters[this.state.activeClusterIdx] || null;
  },

  // ── Get active scene ──
  get activeScene() {
    const cluster = this.activeCluster;
    if (!cluster) return null;
    return cluster.scenes[this.state.activeSceneIdx] || null;
  },

  // ── Add scene to cluster ──
  addScene(clusterIdx, sceneData) {
    if (!this.state.clusters[clusterIdx]) return;
    const scene = {
      id: `scene_${Date.now()}`,
      clusterId: this.state.clusters[clusterIdx].id,
      title: sceneData.title || 'Untitled scene',
      prose: sceneData.prose || '',
      status: 'draft', // 'draft' | 'accepted'
      fn: sceneData.fn || '',
      pov: sceneData.pov || '',
      timestamp: Date.now(),
    };
    this.state.clusters[clusterIdx].scenes.push(scene);
    this.save();
    return scene;
  },

  // ── Accept scene ──
  acceptScene(clusterId, sceneId) {
    const cluster = this.state.clusters.find(c => c.id === clusterId);
    if (!cluster) return;
    const scene = cluster.scenes.find(s => s.id === sceneId);
    if (!scene) return;
    scene.status = 'accepted';
    if (!this.state.storyState.written.includes(sceneId)) {
      this.state.storyState.written.push(sceneId);
    }
    // Check if cluster is complete (all scenes accepted)
    if (cluster.scenes.length > 0 && cluster.scenes.every(s => s.status === 'accepted')) {
      cluster.status = 'done';
    } else {
      cluster.status = 'active';
    }
    this.save();
  },

  // ── Navigate to cluster ──
  setActiveCluster(idx) {
    if (idx < 0 || idx >= this.state.clusters.length) return;
    this.state.activeClusterIdx = idx;
    this.state.activeSceneIdx = 0;
    if (this.state.clusters[idx].status === 'unwritten') {
      this.state.clusters[idx].status = 'active';
    }
    this.save();
  },

  // ── Story state helpers ──
  updateStoryState(patch) {
    Object.assign(this.state.storyState, patch);
    this.save();
  },

  // ── Get all accepted prose in order (for export) ──
  getAllAcceptedProse() {
    const result = [];
    for (const cluster of this.state.clusters) {
      for (const scene of cluster.scenes) {
        if (scene.status === 'accepted') {
          result.push({ cluster: cluster.label, scene });
        }
      }
    }
    return result;
  },

  // ── Project setup ──
  setProject(data) {
    this.state.project = {
      title: data.title || 'Untitled',
      genre: data.genre || '',
      tone: data.tone || '',
      pov: data.pov || '',
      premise: data.premise || '',
      createdAt: Date.now(),
    };
    this.save();
  },
};

// ── Toast helper ──
function showToast(msg, type = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast${type ? ' '+type : ''}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Demo story data ──
const DEMO_STORY = {
  title: 'Ashes of Us',
  genre: 'Literary fiction',
  tone: 'Restrained, melancholic, precise',
  pov: 'Third person limited — Robert',
  premise: 'Three young men whose intense friendship forms in the early 2000s and fractures over time. Robert, a corporate lawyer whose public ethics conceal a private betrayal.',
  outline: `Ashes of Us — story outline

Three men: Robert, Marcus, and Daniel. They meet at university in 2001. Robert is the steady one — serious, principled, already composing himself into someone. Marcus is warmth and trouble in equal parts. Daniel is the wildcard, present then absent, a pressure point between the other two.

The story opens in the present, 2024. Robert is a senior partner at a City firm. He receives a message from Marcus he wasn't expecting. Their friendship has been dormant for years — not ended, just set down somewhere and not picked back up.

The story moves between past and present. The past: London in the early 2000s, the three of them sharing a flat in Bethnal Green, the particular energy of a friendship that feels like it will last forever. The present: Robert in a life that looks exactly as intended, but which contains something he has never told anyone.

The central event — the betrayal — happens at the midpoint. Robert, early in his career, made a choice that benefited him and harmed someone he loved. He has lived with this in a way that looks like compartmentalisation but is closer to erasure.

Marcus's message reopens everything. They meet. The past keeps interrupting the present. Daniel, it turns out, is what Marcus wants to talk about. Something has happened to Daniel.

The crisis: Robert must decide whether to tell the truth — not to a court, but to Marcus — about what he did and what it cost Daniel. The truth would change how Marcus sees him. It might destroy what remains of the friendship. It would also, possibly, be the first honest thing Robert has done in fifteen years.

The ending: Robert tells him. The aftermath is not redemption — it is something quieter and more complicated. A kind of return to ground.

Themes: Male friendship, dissociation, the duality of love and power, fire as a recurring motif, the cost of self-construction.

Characters:
Robert — protagonist, corporate lawyer, 42. Controlled, intelligent, emotionally armoured. Wants: to be seen as good. Fears: being found out.
Marcus — Robert's closest friend, now estranged. Warm, perceptive, not easily fooled. Wants: the truth. Fears: that he already knows it.
Daniel — absent presence. Wild, destructive, beloved. The person Robert's betrayal most affected.`,
  characters: [
    { name: 'Robert', role: 'Protagonist', want: 'To be seen as good', fear: 'Being found out', arc: 'From erasure toward honesty' },
    { name: 'Marcus', role: 'Antagonist/Ally', want: 'The truth', fear: 'That he already knows it', arc: 'From patience to confrontation' },
    { name: 'Daniel', role: 'Absent presence', want: 'Unknown', fear: 'Unknown', arc: 'Revealed through memory' },
  ],
  themes: ['Male friendship', 'Dissociation', 'Love and power', 'Self-construction', 'Fire motif'],
  threads: ['The nature of Robert\'s betrayal', 'What happened to Daniel', 'Whether Marcus already knows', 'The Bethnal Green flat — memory vs reality'],
};

window.NarrativeApp = NarrativeApp;
window.showToast = showToast;
window.DEMO_STORY = DEMO_STORY;
