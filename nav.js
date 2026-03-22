// ════════════════════════════════════════════════════════
//  BodyLens — nav.js  v2.0
//  Shared across all pages.
//  Handles: navigation, dynamic AI coach (profile-aware),
//  localStorage, tooltips, day-date mapping.
// ════════════════════════════════════════════════════════

// ── PROFILE STORE ────────────────────────────────────────
// Single source of truth. All pages read from here.
const BL_STORE = {
  get(key)     { try { return JSON.parse(localStorage.getItem('bl_' + key)); } catch(e) { return null; } },
  set(key, val){ try { localStorage.setItem('bl_' + key, JSON.stringify(val)); return true; } catch(e) { return false; } },
  del(key)     { try { localStorage.removeItem('bl_' + key); } catch(e) {} },
  has(key)     { return localStorage.getItem('bl_' + key) !== null; },
  clear()      { try { Object.keys(localStorage).filter(k => k.startsWith('bl_')).forEach(k => localStorage.removeItem(k)); } catch(e) {} },
};

// ── PROFILE HELPERS ──────────────────────────────────────
function getProfile() {
  return BL_STORE.get('profile') || null;
}

function hasProfile() {
  const p = getProfile();
  return p && p.name && p.goal;
}

function buildSystemPrompt(profile) {
  if (!profile) {
    // Fallback — no profile yet
    return `You are BodyLens Coach — a precise, evidence-based personal performance advisor. 
The user has not yet completed their profile. 
Encourage them to complete onboarding at bodylens-onboard.html so you can give personalised advice.
TONE: Warm, direct, expert. Never generic. 3-5 sentences maximum.`;
  }

  const p = profile;
  const injuries = p.injuries && p.injuries.length
    ? p.injuries.map(i => `${i.location}: ${i.detail}`).join('. ')
    : 'None reported.';

  const nonneg = p.nonNegotiables && p.nonNegotiables.length
    ? p.nonNegotiables.join(', ')
    : 'Not specified.';

  return `You are BodyLens Coach — a precise, evidence-based personal performance advisor acting as a 24/7 personal trainer, nutritionist, and sports physio for this specific person. You know everything about them. Answer every question in the context of their specific programme, goals, and constraints. Never give generic advice. Never say "consult a doctor" unless genuinely warranted.

═══ PERSON PROFILE ═══
Name: ${p.name || 'User'}
Age: ${p.age || 'not given'}
Sex: ${p.sex || 'not given'}
Height: ${p.height || 'not given'}
Weight: ${p.weight || 'not given'}
Body fat: ${p.bodyFat ? p.bodyFat + '%' : 'not given'}
Fat storage: ${p.fatStorage || 'not given'}
Training experience: ${p.experience || 'not given'}

═══ GOALS ═══
Primary: ${p.goal || 'not given'}
Target: ${p.target || 'not given'}
Timeline: ${p.timeline || 'not given'}
Secondary: ${p.secondaryGoals ? p.secondaryGoals.join(', ') : 'none'}

═══ TRAINING ═══
Days/week: ${p.trainingDays || 'not given'}
Schedule: ${p.trainingSchedule || 'not given'}
Wake time: ${p.wakeTime || '06:00'}
Gym access: ${p.gymAccess || 'full commercial gym'}
Equipment exclusions: ${p.equipmentExclusions || 'none'}
Recovery tools: ${p.recoveryTools ? p.recoveryTools.join(', ') : 'not given'}

═══ NUTRITION ═══
Approach: ${p.dietType || 'not given'}
Calories: ${p.calories || 'not given'} kcal/day
Protein: ${p.protein || 'not given'}g
Carbs: ${p.carbs || 'not given'}g
Fat: ${p.fat || 'not given'}g
Exclusions: ${p.foodExclusions ? p.foodExclusions.join(', ') : 'none'}
Trigger foods: ${p.triggerFoods || 'none'}
Eating window: ${p.eatingWindow || 'not given'}

═══ INJURIES & CONSTRAINTS ═══
${injuries}

═══ NON-NEGOTIABLES ═══
${nonneg}

═══ SUPPLEMENTS ═══
${p.supplements ? p.supplements.join(', ') : 'not given'}

═══ TODAY'S CONTEXT ═══
Day: ${getTodayName()}
Plan type: ${getTodayPlanType(p)}
${p.foodLog ? 'Food logged today: ' + p.foodLog : 'No food logged yet today.'}

═══ SCIENCE KNOWLEDGE BASE ═══
Apply this mechanistic knowledge when relevant:
- mTOR activation requires both mechanical tension (training) AND leucine (~2.5g per meal). Both keys needed.
- Alcohol directly blocks mTOR phosphorylation — a training session followed by alcohol = stimulus without adaptation.
- GH pulses in first slow-wave sleep cycle. Alcohol within 4h, poor sleep hygiene, sub-6h sleep all suppress it.
- Cortisol and testosterone are inversely related. Chronic cortisol elevation suppresses HPT axis regardless of training.
- Collagen + Vitamin C 45-60 min pre-training = 5.5x connective tissue synthesis during loading window (Shaw 2017).
- Omega-3 amplifies MPS response to the same protein dose by 20-35% in adults over 40.
- Zone 2 cardio activates PGC-1α → mitochondrial biogenesis. The primary longevity intervention.
- VO2max is the strongest predictor of all-cause mortality — more predictive than smoking, BP, or metabolic syndrome.
- Visceral fat secretes TNF-α and IL-6 directly into portal circulation. Reducing it IS inflammation management.
- 95% of serotonin produced in the gut. Gut dysbiosis mechanistically causes anxiety — not as a side effect, as a direct output.
- Insulin sensitivity determines whether surplus calories go to muscle or fat. Training, sleep, omega-3, and protein all improve it.
- Leucine threshold for mTOR activation: ~2.5g per meal. Below this = no MPS signal regardless of total daily protein.
- Cold exposure: noradrenaline +200-300%, dopamine elevated 2-4h, HPA recalibration over weeks of consistency.
- Magnesium glycinate: GABA receptor cofactor. Low magnesium = inadequate GABAergic inhibition = brain won't switch off.
- Ashwagandha KSM-66: modulates HPA axis, reduces cortisol ~25-30% in RCTs. Testosterone support via HPT axis.
- Sauna post-training: second GH pulse (up to 16x baseline), HSP70/HSP90 heat shock protein activation.
- Hydro pool: 70% bodyweight reduction. Only way to deliver nutrients to avascular cartilage without loading a meniscal tear.
- Degenerative meniscal tears: appropriate progressive loading does NOT worsen them. Posterior chain training = structural joint therapy.

═══ TONE ═══
Senior, dry, precise. Mechanistic not motivational. 3-5 sentences maximum. Answer the actual question. Never waffle. Never generic.`;
}

// ── DAY HELPERS ──────────────────────────────────────────
const DAY_MAP = { 0:6, 1:0, 2:1, 3:2, 4:3, 5:4, 6:5 }; // JS Sun=0 → programme Sun=6
const DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function getTodayIndex() {
  return DAY_MAP[new Date().getDay()];
}

function getTodayName() {
  return DAY_NAMES[getTodayIndex()];
}

function getTodayPlanType(profile) {
  if (!profile || !profile.weekPlan) return 'Not yet generated';
  const plan = profile.weekPlan[getTodayIndex()];
  return plan ? plan.type : 'Rest';
}

// ── ACTIVE NAV LINK ──────────────────────────────────────
(function() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(a => {
    const href = (a.getAttribute('href') || '').replace('.html','');
    if (href && page.includes(href.replace('bodylens-',''))) {
      a.classList.add('active');
    }
  });
})();

// ── AI COACH ─────────────────────────────────────────────
// The coach is context-aware: it builds its system prompt
// from the current stored profile every time it's called.

async function sendCoach(inputId, respId, btnId, extraCtx) {
  const inp  = document.getElementById(inputId);
  const resp = document.getElementById(respId);
  const btn  = document.getElementById(btnId);
  const q    = inp ? inp.value.trim() : '';
  if (!q) return;
  if (btn) btn.disabled = true;
  resp.className = 'ai-resp loading';
  resp.textContent = 'Thinking…';
  if (inp) inp.value = '';

  const profile = getProfile();
  const systemPrompt = buildSystemPrompt(profile);

  // Build context from extra info passed by page
  const messages = [];
  if (extraCtx) {
    messages.push({ role: 'user', content: extraCtx });
    messages.push({ role: 'assistant', content: 'Understood. What would you like to know?' });
  }
  messages.push({ role: 'user', content: q });

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        system: systemPrompt,
        messages,
      }),
    });
    const data = await res.json();
    resp.className = 'ai-resp';
    resp.textContent = data.content?.map(b => b.text || '').join('') || 'No response.';
  } catch(e) {
    resp.className = 'ai-resp';
    resp.textContent = 'Connection error — check network and try again.';
  }
  if (btn) btn.disabled = false;
}

function askCoach(btn, inputId, respId, btnId, ctx) {
  const inp = document.getElementById(inputId);
  if (inp) inp.value = btn.textContent.trim();
  sendCoach(inputId, respId, btnId, ctx || '');
}

// Quick coach — takes a question string, returns a promise with the answer
// Used for page-level AI generation (daily plan, meal suggestions etc)
async function quickCoach(question, extraContext, maxTokens) {
  const profile = getProfile();
  const systemPrompt = buildSystemPrompt(profile);
  const messages = [{ role: 'user', content: question }];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens || 1200,
      system: (extraContext ? extraContext + '\n\n' : '') + systemPrompt,
      messages,
    }),
  });
  const data = await res.json();
  return data.content?.map(b => b.text || '').join('') || '';
}

// ── FOOD LOG ─────────────────────────────────────────────
// Simple daily food log — resets at midnight
function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function getFoodLog() {
  const log = BL_STORE.get('foodlog_' + getTodayKey());
  return log || [];
}

function addFoodEntry(entry) {
  const log = getFoodLog();
  log.push({ ...entry, time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) });
  BL_STORE.set('foodlog_' + getTodayKey(), log);
  // Also update profile food log summary for coach context
  const profile = getProfile();
  if (profile) {
    profile.foodLog = log.map(e => `${e.time} ${e.name} (~${e.calories || '?'}kcal)`).join(', ');
    BL_STORE.set('profile', profile);
  }
  return log;
}

function getTodayMacros() {
  const log = getFoodLog();
  return log.reduce((acc, e) => ({
    calories: acc.calories + (e.calories || 0),
    protein:  acc.protein  + (e.protein  || 0),
    carbs:    acc.carbs    + (e.carbs    || 0),
    fat:      acc.fat      + (e.fat      || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

// ── UI UTILITIES ─────────────────────────────────────────
function toggleProto(card) { card.classList.toggle('expanded'); }
function toggleScenario(el) { el.classList.toggle('open'); }

function selectOpt(btn, group, warn) {
  btn.closest('.ci-options').querySelectorAll('.ci-opt').forEach(b => b.classList.remove('sel','sel-warn'));
  btn.classList.add(warn ? 'sel-warn' : 'sel');
}

function switchTab(paneId, btn) {
  const scope = btn ? (btn.closest('.tab-scope') || document) : document;
  scope.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  scope.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const p = document.getElementById(paneId);
  if (p) p.classList.add('active');
}

// ── WAKE TIME ────────────────────────────────────────────
function restorePreferences() {
  const wakeEl = document.getElementById('wake-select');
  if (wakeEl) {
    const saved = BL_STORE.get('wake_time');
    if (saved) wakeEl.value = saved;
    wakeEl.addEventListener('change', () => BL_STORE.set('wake_time', wakeEl.value));
  }
}

// ── PROFILE REDIRECT GUARD ───────────────────────────────
// Pages that require a profile to function can call this.
// If no profile, redirects to onboarding.
function requireProfile() {
  if (!hasProfile()) {
    const current = location.pathname.split('/').pop();
    if (current !== 'bodylens-onboard.html' && current !== 'index.html') {
      location.href = 'bodylens-onboard.html';
    }
  }
}

// ── GLOSSARY / TOOLTIPS ──────────────────────────────────
const GLOSSARY = {
  'RPE':    'Rate of Perceived Exertion — 1–10 scale. RPE 8 = 2 reps left in the tank.',
  'MPS':    'Muscle Protein Synthesis — building new muscle tissue. Triggered by training + leucine.',
  'mTOR':   'Mechanistic Target of Rapamycin — the molecular switch for muscle building. Needs leucine + mechanical tension.',
  'GH':     'Growth Hormone — released during deep sleep. Drives muscle repair and connective tissue remodelling.',
  'VO₂max': 'Maximum oxygen uptake — strongest predictor of longevity. More predictive than smoking, blood pressure, or metabolic syndrome.',
  'DOMS':   'Delayed Onset Muscle Soreness — the ache 24–48h after training. Normal. Not an injury.',
  'ROM':    'Range of Motion — the full movement range a joint can safely perform.',
  'MCL':    'Medial Collateral Ligament — inner knee ligament.',
  'ACL':    'Anterior Cruciate Ligament — main knee stabiliser.',
  'ATP':    'Adenosine Triphosphate — the energy molecule cells run on. Creatine speeds regeneration.',
  'CNS':    'Central Nervous System — needs to be fresh for heavy compound lifts.',
  'RDL':    'Romanian Deadlift — hip hinge with minimal knee flexion. Loads hamstrings and glutes.',
  'EPA':    'Eicosapentaenoic acid — omega-3 fatty acid. Reduces joint inflammation.',
  'DHA':    'Docosahexaenoic acid — omega-3 fatty acid. Structural brain tissue.',
  'COX':    'Cyclo-oxygenase — enzyme that produces inflammation. Omega-3 competes here.',
  'IGF-1':  'Insulin-like Growth Factor 1 — produced in response to GH. Drives muscle synthesis.',
  'KSM-66': 'The specific standardised ashwagandha extract used in clinical trials. Generic ashwagandha is inconsistent.',
  'HPA':    'Hypothalamic-Pituitary-Adrenal axis — the stress response system. Ashwagandha, Zone 2, and cold exposure all recalibrate it.',
  'BDNF':   'Brain-Derived Neurotrophic Factor — produced during exercise. Opens a neuroplasticity window for 2–4 hours post-session.',
};

function applyTooltips(root) {
  root = root || document.body;
  const terms = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
  const skip  = new Set(['SCRIPT','STYLE','INPUT','TEXTAREA','SELECT','BUTTON','A','SPAN']);

  function esc(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function walk(node) {
    if (skip.has(node.nodeName)) return;
    if (node.nodeType === 3) {
      const text = node.textContent;
      for (const term of terms) {
        const idx = text.indexOf(term);
        if (idx >= 0 && node.parentElement && !node.parentElement.classList.contains('tip')) {
          const span = document.createElement('span');
          span.innerHTML =
            esc(text.slice(0, idx)) +
            `<span class="tip" data-tip="${esc(GLOSSARY[term])}">${esc(term)}</span>` +
            esc(text.slice(idx + term.length));
          node.parentNode.replaceChild(span, node);
          break;
        }
      }
    } else {
      Array.from(node.childNodes).forEach(walk);
    }
  }

  const content = root.querySelector('.page,.main-inner,.tab-content,.day-plan');
  if (content) walk(content);
}

// ── INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  restorePreferences();
  setTimeout(() => applyTooltips(document.body), 400);

  // Show profile name in nav if available
  const profile = getProfile();
  if (profile && profile.name) {
    const brand = document.querySelector('.nav-brand');
    if (brand) {
      brand.setAttribute('title', `Logged in as ${profile.name}`);
    }
  }
});
