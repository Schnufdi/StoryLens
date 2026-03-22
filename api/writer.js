// ── narrative/js/writer.js ──
// Scene generation, recalibration, and writing engine

const NarrativeWriter = {

  activeRecal: new Set(), // active recalibration modifiers
  customDirection: '',

  // ── Build generation context ──
  buildContext(app) {
    const proj = app.state.project;
    const cluster = app.activeCluster;
    if (!proj || !cluster) return null;

    // Recent accepted scenes for continuity
    const recentScenes = [];
    for (const c of app.state.clusters) {
      for (const s of c.scenes) {
        if (s.status === 'accepted') recentScenes.push(s);
      }
    }
    const recent = recentScenes.slice(-3);

    return {
      project: proj,
      characters: app.state.characters,
      themes: app.state.themes,
      threads: app.state.threads,
      cluster,
      storyState: app.state.storyState,
      recentScenes: recent,
      arcType: app.state.arcType,
    };
  },

  // ── Build system prompt ──
  buildSystemPrompt(ctx) {
    const chars = ctx.characters.map(c =>
      `${c.name} (${c.role}): wants ${c.want || '?'}, fears ${c.fear || '?'}`
    ).join('\n');

    const recent = ctx.recentScenes.map(s =>
      `[${s.clusterId}] ${s.title}: ${s.prose.substring(0, 300)}...`
    ).join('\n\n');

    const threads = ctx.threads.slice(0, 5).join('; ');

    return `You are a co-writer working on a ${ctx.project.genre} story titled "${ctx.project.title}".

STORY FOUNDATIONS
Premise: ${ctx.project.premise}
Tone: ${ctx.project.tone}
POV: ${ctx.project.pov}
Themes: ${ctx.themes.join(', ')}

CHARACTERS
${chars}

ACTIVE THREADS
${threads || 'None established yet'}

STORY STATE
Current position: ${ctx.cluster.label} — ${ctx.cluster.fn}
Emotional gear: ${ctx.cluster.emotional}
Pacing: ${ctx.cluster.pacing}

RECENT ACCEPTED SCENES (for continuity)
${recent || 'No scenes accepted yet — this is the opening.'}

YOUR TASK
Write a single scene for this structural position. The scene must:
- Serve its dramatic function: ${ctx.cluster.fn}
- Match its emotional register: ${ctx.cluster.emotional}
- Match its pacing: ${ctx.cluster.pacing}
- Stay consistent with established character voices and relationships
- Advance at least one active thread
- Not resolve what should not be resolved at this point in the story

Write prose only. No headers, no meta-commentary. 3-5 paragraphs. Literary quality. Show don't tell.`;
  },

  // ── Build user prompt ──
  buildUserPrompt(ctx, sceneHint, recalibrations, custom) {
    let prompt = `Write a scene for: ${ctx.cluster.label}.`;

    if (sceneHint) prompt += `\n\nScene context: ${sceneHint}`;

    if (ctx.cluster.extractedEvents && ctx.cluster.extractedEvents.length > 0) {
      prompt += `\n\nEvents that should occur in this cluster: ${ctx.cluster.extractedEvents.slice(0, 3).join('; ')}`;
    }

    if (recalibrations.size > 0) {
      const recalMap = {
        'darker': 'Make the tone darker — more shadow, less comfort, more dread.',
        'tension': 'Increase tension — shorter sentences, more at stake, less resolution.',
        'subtext': 'Deepen the subtext — what is not being said should be loud.',
        'slower': 'Slow the pacing — more interior, more sensory detail, breathe.',
        'cinematic': 'Make this more cinematic — sharp images, clean cuts, visual thinking.',
        'dialogue': 'Prioritise dialogue over prose — let the scene live in the exchange.',
        'conflict': 'Deepen the conflict — make the opposition more direct and more felt.',
        'lyrical': 'Elevate the prose — more literary, more precise, more beautiful.',
      };
      const recalInstructions = [...recalibrations].map(r => recalMap[r] || r).join(' ');
      prompt += `\n\nRecalibration: ${recalInstructions}`;
    }

    if (custom && custom.trim()) {
      prompt += `\n\nAdditional direction: ${custom.trim()}`;
    }

    return prompt;
  },

  // ── Generate scene ──
  async generate(app, sceneHint = '') {
    const ctx = this.buildContext(app);
    if (!ctx) throw new Error('No active project or cluster');

    const apiKey = app.state.apiKey;
    if (!apiKey) {
      // Return demo prose if no key
      return this.generateDemo(ctx);
    }

    const systemPrompt = this.buildSystemPrompt(ctx);
    const userPrompt = this.buildUserPrompt(ctx, sceneHint, this.activeRecal, this.customDirection);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.content[0].text.trim();
  },

  // ── Demo generation (no API key) ──
  generateDemo(ctx) {
    const demos = {
      'act1': `The flat was on the fourth floor of a building on Bethnal Green Road, above a fabric shop that smelled of dust and synthetic fibre even in winter. Robert had found it on a notice board at the university. He remembered folding the paper into quarters and putting it in his jacket pocket with the seriousness of a man pocketing a contract.

Marcus arrived with two bags and a borrowed van and the particular energy he always carried, which was less like enthusiasm and more like a forward momentum he couldn't entirely control. He had brought a plant. Robert didn't ask where from.

"It'll die," Robert said.

"Everything does," Marcus said cheerfully, and set it on the windowsill where it proceeded, against all probability, to survive.

Daniel came three days later. He said he'd been sorting something out. He didn't say what. Robert didn't ask. It was the first of many such arrangements.`,

      'act2a': `The meeting had been Marcus's idea, which meant it had been carefully framed as spontaneous. Robert recognised this — had always recognised it — and had come anyway, because the alternative was to acknowledge what the recognition meant.

The bar was loud enough to require leaning in. Robert found this useful. It meant he could control what he heard.

"You look well," Marcus said.

"I am well."

"You've always been terrible at this."

Robert turned his glass. Outside, the rain had begun again, that particular London rain that arrives without drama and stays for days. "At what," he said, though he knew.

"Being asked about yourself and answering."`,

      'midpoint': `He told himself, afterwards, that the decision had been made before he knew he was making it. That there was a logic to it that transcended the event itself. This was the first lie, and it was the one that made all the others possible.

The Whitmore file sat on his desk for eleven days before he acted on it. In those eleven days he understood, with a clarity he had not asked for, what he was capable of. Not in the abstract — in the specific, with names attached.

He chose himself. He would spend fifteen years explaining to himself why this was not what it was.`,

      'default': `The room held the particular quality of a decision already made. Robert was aware of this and aware that his awareness changed nothing — which was, he had come to understand, the nature of decisions made in rooms like this.

He had prepared three versions of what he might say. The first was true. The second was almost true. The third was what he said.

Afterwards, walking east through streets he had walked for twenty years, he tried to locate the moment it had changed — the exact second at which the person he had intended to be became the person he was. He could not find it. He suspected this was by design.`
    };

    const clusterId = ctx.cluster.id;
    return demos[clusterId] || demos['default'];
  },

  // ── Suggest scene title ──
  suggestTitle(prose, clusterLabel) {
    // Simple: find first proper noun phrase or use cluster + scene number
    const match = prose.match(/[A-Z][a-z]+ (?:at|in|on|of|and) [A-Z][a-z]+/);
    if (match) return match[0];
    return `${clusterLabel} — scene`;
  },

  // ── Update story state after scene accepted ──
  updateStateFromScene(prose, app) {
    // Simple heuristic extraction from accepted scene
    const state = app.state.storyState;

    // Detect POV character mentioned
    const chars = app.state.characters;
    for (const c of chars) {
      if (prose.includes(c.name)) {
        state.currentPOV = c.name;
        break;
      }
    }

    // Tone state from prose feel
    const lower = prose.toLowerCase();
    if (lower.includes('dark') || lower.includes('dread') || lower.includes('fear')) {
      state.toneState = 'dark';
    } else if (lower.includes('tender') || lower.includes('warm') || lower.includes('laugh')) {
      state.toneState = 'warm';
    }

    app.state.storyState = state;
    app.save();
  },
};

window.NarrativeWriter = NarrativeWriter;
