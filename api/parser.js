// ── narrative/js/parser.js ──
// Outline import, extraction, and story structure analysis

const NarrativeParser = {

  // ── Main parse function (calls AI or uses heuristics) ──
  async parse(rawText, apiKey) {
    if (apiKey) {
      try {
        return await this.parseWithAI(rawText, apiKey);
      } catch(e) {
        console.warn('AI parse failed, falling back to heuristic:', e);
      }
    }
    return this.parseHeuristic(rawText);
  },

  // ── AI-powered parse ──
  async parseWithAI(rawText, apiKey) {
    const systemPrompt = `You are a narrative analysis engine. Your job is to extract structured story elements from a pasted outline, synopsis, or story document.

Return ONLY valid JSON with this exact structure:
{
  "title": "string or null",
  "genre": "string or null",
  "tone": "string or null",
  "pov": "string or null",
  "premise": "one sentence string",
  "characters": [
    { "name": "string", "role": "string", "want": "string", "fear": "string", "arc": "string", "confidence": "high|med|low" }
  ],
  "plotEvents": [
    { "event": "string", "weight": "pivotal|supporting|transitional", "position": "early|mid|late", "confidence": "high|med|low" }
  ],
  "emotionalBeats": [
    { "beat": "string", "type": "revelation|rupture|connection|collapse|shift", "confidence": "high|med|low" }
  ],
  "themes": ["string"],
  "motifs": ["string"],
  "openThreads": ["string"],
  "structuralSignals": ["string"],
  "centralConflict": "string"
}

confidence field: high = explicitly stated, med = clearly implied, low = inferred.
Be specific, not vague. Extract what is actually there.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Parse this story outline:\n\n${rawText}` }]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    const text = data.content[0].text.trim();
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  },

  // ── Heuristic parse (no API key) ──
  parseHeuristic(rawText) {
    const text = rawText.trim();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // Extract title (first line if short)
    let title = null;
    if (lines[0] && lines[0].length < 60) title = lines[0].replace(/^#\s*/, '');

    // Characters: look for name patterns
    const characters = this.extractCharacters(text);

    // Themes: look for theme-like keywords
    const themes = this.extractThemes(text);

    // Motifs: explicit mentions
    const motifs = this.extractMotifs(text);

    // Open threads: questions and unresolved phrases
    const openThreads = this.extractThreads(text);

    // Structural signals: arc phrases
    const structuralSignals = this.extractStructuralSignals(text);

    // Plot events: sentences with strong verbs
    const plotEvents = this.extractPlotEvents(text);

    // Central conflict
    const centralConflict = this.extractConflict(text);

    // Premise: first substantial paragraph
    const premise = this.extractPremise(text);

    return {
      title,
      genre: this.inferGenre(text),
      tone: this.inferTone(text),
      pov: this.inferPOV(text),
      premise,
      characters,
      plotEvents,
      emotionalBeats: [],
      themes,
      motifs,
      openThreads,
      structuralSignals,
      centralConflict,
    };
  },

  extractCharacters(text) {
    const chars = [];
    // Look for lines with name patterns: "Name —" or "Name:" or capitalized proper nouns with descriptions
    const patterns = [
      /^([A-Z][a-z]+)\s*[—–-]\s*(.+)/gm,
      /^([A-Z][a-z]+)\s*:\s*(.+)/gm,
      /\b([A-Z][a-z]+)\s+is\s+(?:the\s+)?(\w+)/g,
    ];
    const found = new Set();
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1];
        if (found.has(name) || name.length < 3) continue;
        if (['The', 'His', 'Her', 'This', 'That', 'They', 'What', 'When', 'Where', 'Who'].includes(name)) continue;
        found.add(name);
        chars.push({
          name,
          role: 'Character',
          want: 'Unknown',
          fear: 'Unknown',
          arc: 'To be determined',
          confidence: 'low'
        });
      }
    }
    // Look for explicit character blocks
    const charSection = text.match(/[Cc]haracters?:([\s\S]*?)(?:\n\n|\n[A-Z]|$)/);
    if (charSection) {
      const lines = charSection[1].split('\n').filter(Boolean);
      for (const line of lines) {
        const m = line.match(/^([A-Z][a-z]+)/);
        if (m && !found.has(m[1])) {
          found.add(m[1]);
          const wantMatch = line.match(/[Ww]ants?:?\s*([^.]+)/);
          const fearMatch = line.match(/[Ff]ears?:?\s*([^.]+)/);
          chars.push({
            name: m[1],
            role: 'Character',
            want: wantMatch ? wantMatch[1].trim() : 'Unknown',
            fear: fearMatch ? fearMatch[1].trim() : 'Unknown',
            arc: 'To be determined',
            confidence: 'high'
          });
        }
      }
    }
    return chars.slice(0, 8);
  },

  extractThemes(text) {
    const themeWords = ['friendship', 'love', 'power', 'betrayal', 'identity', 'memory', 'loss', 'redemption', 'truth', 'family', 'ambition', 'loyalty', 'grief', 'desire', 'freedom', 'justice', 'class', 'race', 'gender', 'mortality'];
    const found = [];
    const lower = text.toLowerCase();
    for (const t of themeWords) {
      if (lower.includes(t) && !found.includes(t)) found.push(t);
    }
    // Also look for explicit theme section
    const themeSection = text.match(/[Tt]hemes?:([^\n]+)/);
    if (themeSection) {
      const explicit = themeSection[1].split(/[,;]/).map(s => s.trim()).filter(Boolean);
      for (const t of explicit) {
        if (!found.includes(t.toLowerCase())) found.push(t);
      }
    }
    return found.slice(0, 8).map(t => t.charAt(0).toUpperCase() + t.slice(1));
  },

  extractMotifs(text) {
    const motifSection = text.match(/[Mm]otifs?:([^\n]+)/);
    if (motifSection) {
      return motifSection[1].split(/[,;]/).map(s => s.trim()).filter(Boolean).slice(0, 6);
    }
    return [];
  },

  extractThreads(text) {
    const threads = [];
    // Questions in text
    const questions = text.match(/[A-Z][^.!?]*\?/g) || [];
    for (const q of questions.slice(0, 3)) threads.push(q.trim());
    // "whether" clauses
    const whether = text.match(/whether\s+[^.]+\./g) || [];
    for (const w of whether.slice(0, 3)) threads.push(w.charAt(0).toUpperCase() + w.slice(1).trim());
    return threads.slice(0, 5);
  },

  extractStructuralSignals(text) {
    const signals = [];
    const arcPhrases = [
      /everything changes when/gi,
      /the real problem becomes/gi,
      /by the end/gi,
      /the turning point/gi,
      /the crisis/gi,
      /the climax/gi,
      /opens with/gi,
      /story begins/gi,
      /present[-, ]/gi,
    ];
    for (const phrase of arcPhrases) {
      const m = text.match(phrase);
      if (m) signals.push(m[0]);
    }
    return signals.slice(0, 6);
  },

  extractPlotEvents(text) {
    const events = [];
    // Strong-verb sentences
    const sentences = text.match(/[A-Z][^.!?]+[.!?]/g) || [];
    const strongVerbs = ['betrayed', 'discovered', 'revealed', 'confronted', 'left', 'died', 'returned', 'chose', 'told', 'lied', 'killed', 'met', 'married', 'broke', 'escaped'];
    for (const s of sentences) {
      const lower = s.toLowerCase();
      if (strongVerbs.some(v => lower.includes(v))) {
        events.push({ event: s.trim(), weight: 'supporting', position: 'mid', confidence: 'med' });
      }
    }
    return events.slice(0, 10);
  },

  extractConflict(text) {
    const patterns = [
      /central conflict:?\s*([^\n.]+)/i,
      /the story is about ([^\n.]+)/i,
      /at stake[:\s]+([^\n.]+)/i,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return m[1].trim();
    }
    return 'Central conflict to be defined';
  },

  extractPremise(text) {
    const lines = text.split('\n').filter(l => l.trim().length > 40);
    if (lines[0]) return lines[0].trim().substring(0, 200);
    return text.substring(0, 200);
  },

  inferGenre(text) {
    const lower = text.toLowerCase();
    if (lower.includes('literary')) return 'Literary fiction';
    if (lower.includes('thriller')) return 'Thriller';
    if (lower.includes('romance')) return 'Romance';
    if (lower.includes('fantasy')) return 'Fantasy';
    if (lower.includes('sci-fi') || lower.includes('science fiction')) return 'Science fiction';
    if (lower.includes('horror')) return 'Horror';
    if (lower.includes('mystery')) return 'Mystery';
    if (lower.includes('screenplay') || lower.includes('script')) return 'Screenplay';
    return 'Fiction';
  },

  inferTone(text) {
    const lower = text.toLowerCase();
    if (lower.includes('dark') || lower.includes('grief')) return 'Dark, serious';
    if (lower.includes('funny') || lower.includes('comic') || lower.includes('humour')) return 'Comic';
    if (lower.includes('melanchol') || lower.includes('elegiac')) return 'Melancholic';
    if (lower.includes('tense') || lower.includes('urgent')) return 'Tense';
    return 'Dramatic';
  },

  inferPOV(text) {
    const lower = text.toLowerCase();
    if (lower.includes('first person') || lower.includes('i ') && lower.indexOf('i ') < 200) return 'First person';
    if (lower.includes('third person limited')) return 'Third person limited';
    if (lower.includes('third person omniscient')) return 'Third person omniscient';
    if (lower.includes('multiple') || lower.includes('alternating')) return 'Multiple POV';
    return 'Third person';
  },

  // ── Map extracted data to arc clusters ──
  mapToArc(parsed, clusters) {
    const total = clusters.length;
    const events = parsed.plotEvents || [];

    // Simple distribution: spread events across clusters
    events.forEach((evt, i) => {
      const clusterIdx = Math.floor((i / Math.max(events.length, 1)) * total);
      const cluster = clusters[Math.min(clusterIdx, total - 1)];
      if (!cluster.extractedEvents) cluster.extractedEvents = [];
      cluster.extractedEvents.push(evt.event);
    });

    // First cluster gets setup context
    if (clusters[0]) {
      clusters[0].context = parsed.premise || '';
    }

    // Last cluster gets ending context
    const endSignal = parsed.structuralSignals.find(s => /end|resolution|denouement/i.test(s));
    if (endSignal && clusters[total-1]) {
      clusters[total-1].endingSignal = endSignal;
    }

    return clusters;
  }
};

window.NarrativeParser = NarrativeParser;
