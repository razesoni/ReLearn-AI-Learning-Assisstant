/**
 * Margin — sample mode.
 * Used only when /api/auth/me does not exist (no backend connected yet).
 * Everything lives in this browser's localStorage. No passwords are stored or checked:
 * this is a UI preview, not an authentication system.
 */
(function () {
  'use strict';

  const KEY = 'margin-demo-db';
  const PROCESS_MS = 6500;
  const STAGE_KEYS = ['intake', 'text', 'summary', 'terms', 'quiz'];

  const empty = () => ({ user: null, sets: [], attempts: [] });
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || empty(); } catch (e) { return empty(); }
  }
  function save(db) { localStorage.setItem(KEY, JSON.stringify(db)); }
  const uid = () => Math.random().toString(36).slice(2, 10);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function fail(message, status) {
    const err = new Error(message);
    err.status = status || 400;
    return err;
  }

  function location(kind, i) {
    if (kind === 'pdf') return 'p. ' + (i + 2);
    const m = 2 + i * 3;
    return String(m).padStart(2, '0') + ':' + (i % 2 ? '40' : '15');
  }

  function sampleContent(kind, questionCount) {
    const terms = [
      ['photosynthesis', 'The process by which plants, algae and some bacteria turn light, water and carbon dioxide into sugar and oxygen.'],
      ['chloroplast', 'The organelle inside plant cells where photosynthesis takes place. It contains stacks of membranes called thylakoids.'],
      ['chlorophyll', 'The green pigment in chloroplasts that absorbs light, mainly red and blue wavelengths.'],
      ['light-dependent reactions', 'The first stage of photosynthesis. Light energy splits water and is stored in ATP and NADPH, releasing oxygen.'],
      ['Calvin cycle', 'The second stage of photosynthesis. It uses ATP and NADPH to fix carbon dioxide into sugar.'],
      ['ATP', 'Adenosine triphosphate, the small molecule cells use to carry energy from one reaction to another.'],
      ['glucose', 'A six-carbon sugar, C6H12O6, built from carbon dioxide during the Calvin cycle.'],
      ['stomata', 'Tiny pores on the underside of leaves that let carbon dioxide in and oxygen and water vapour out.'],
      ['limiting factor', 'The resource in shortest supply, which caps how fast a process can run no matter how much of the others is available.']
    ].map((t, i) => ({ term: t[0], definition: t[1], where: location(kind, i) }));

    const questions = [
      {
        id: 'q1', type: 'mcq', difficulty: 'easy',
        prompt: 'In which part of the cell does photosynthesis take place?',
        options: ['Mitochondrion', 'Chloroplast', 'Ribosome', 'Nucleus'], answer: 1,
        explanation: 'Chloroplasts hold the chlorophyll and membranes that capture light. Mitochondria handle cellular respiration instead.'
      },
      {
        id: 'q2', type: 'mcq', difficulty: 'easy',
        prompt: 'Which products leave the light-dependent reactions?',
        options: ['Glucose and carbon dioxide', 'ATP, NADPH and oxygen', 'Water and nitrogen', 'Starch and ethanol'], answer: 1,
        explanation: 'Light splits water, releasing oxygen. The energy is stored as ATP and NADPH, which the Calvin cycle uses next.'
      },
      {
        id: 'q3', type: 'numeric', difficulty: 'medium', unit: 'molecules', tolerance: 0, answer: 24,
        prompt: 'Six carbon dioxide molecules are fixed to build one glucose molecule (C6H12O6). How many carbon dioxide molecules are needed to build 4 glucose molecules?',
        steps: ['One glucose needs 6 CO2.', 'Four glucose need 4 × 6 = 24 CO2.'],
        explanation: 'Each glucose has six carbon atoms, and each CO2 supplies one.'
      },
      {
        id: 'q4', type: 'mcq', difficulty: 'medium',
        prompt: 'In a greenhouse, the photosynthesis rate stops rising even though the lamps are turned up. The air is low in carbon dioxide. What is the limiting factor?',
        options: ['Light intensity', 'Carbon dioxide concentration', 'Chlorophyll', 'Oxygen'], answer: 1,
        explanation: 'More light cannot help once carbon dioxide runs short. The scarcest input sets the ceiling.'
      },
      {
        id: 'q5', type: 'numeric', difficulty: 'hard', unit: 'µmol', tolerance: 0, answer: 360,
        prompt: 'A leaf fixes carbon dioxide at 12 µmol per square metre per second. How many µmol does 3 square metres of leaf fix in 10 seconds?',
        steps: ['Rate for 3 m² = 12 × 3 = 36 µmol per second.', 'Over 10 seconds = 36 × 10 = 360 µmol.'],
        explanation: 'Multiply the rate by the area, then by the time.'
      },
      {
        id: 'q6', type: 'reveal', difficulty: 'hard',
        prompt: 'In your own words, explain why the Calvin cycle depends on the light-dependent reactions.',
        modelAnswer: 'The Calvin cycle needs ATP and NADPH to turn carbon dioxide into sugar. Those carriers are made in the light-dependent reactions, so without light the cycle runs out of energy.',
        explanation: 'Look for both parts: what the Calvin cycle needs, and where it comes from.'
      }
    ];

    return {
      summary: {
        overview: 'Photosynthesis is how plants, algae and some bacteria turn light into chemical energy stored in sugar. It happens in two linked stages inside the chloroplast. The light-dependent reactions capture light with chlorophyll, split water and release oxygen. The Calvin cycle then uses the energy those reactions stored to fix carbon dioxide into glucose.',
        sections: [
          { heading: 'Where it happens', body: 'Photosynthesis takes place in the chloroplast. Carbon dioxide enters the leaf through the stomata, and water arrives from the roots. Chlorophyll in the chloroplast membranes absorbs the light that drives the whole process.' },
          { heading: 'Stage one: light-dependent reactions', body: 'Light energy is used to split water. Oxygen is released as a by-product, and the energy is captured in ATP and NADPH. These two molecules are the hand-off to the next stage.' },
          { heading: 'Stage two: the Calvin cycle', body: 'The Calvin cycle spends the ATP and NADPH to fix carbon dioxide into glucose. It does not use light directly, but it stalls when the light-dependent reactions stop supplying energy.' },
          { heading: 'What limits the rate', body: 'Light intensity, carbon dioxide concentration and temperature all affect how fast photosynthesis runs. Whichever is in shortest supply is the limiting factor, and raising the others will not speed things up.' }
        ]
      },
      key_points: [
        'Photosynthesis converts light, water and carbon dioxide into glucose and oxygen.',
        'It takes place in the chloroplast, using chlorophyll to absorb light.',
        'The light-dependent reactions split water and store energy as ATP and NADPH.',
        'The Calvin cycle uses that stored energy to fix carbon dioxide into glucose.',
        'Stomata control how much carbon dioxide enters the leaf.',
        'The limiting factor is the scarcest input, and it caps the overall rate.'
      ],
      terms: terms,
      quiz: { questions: questions.slice(0, Math.max(3, Math.min(questionCount || 6, questions.length))) }
    };
  }

  function titleFromFile(name) {
    return String(name || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  }

  function stagesFor(set, now) {
    const elapsed = now - set.created_ms;
    const per = PROCESS_MS / STAGE_KEYS.length;
    const stages = {};
    let current = null;
    STAGE_KEYS.forEach((key, i) => {
      if (elapsed >= (i + 1) * per) stages[key] = 'done';
      else if (elapsed >= i * per) { stages[key] = 'active'; current = key; }
      else stages[key] = 'pending';
    });
    return { stages, current };
  }

  // Lazily move a set from "processing" to "ready" once enough time has passed.
  function settle(db) {
    let changed = false;
    const now = Date.now();
    db.sets.forEach(set => {
      if (set.status === 'processing' && now - set.created_ms >= PROCESS_MS) {
        const content = sampleContent(set.kind, set.num_questions);
        Object.assign(set, content, { status: 'ready' });
        changed = true;
      }
    });
    if (changed) save(db);
    return db;
  }

  function attemptsFor(db, id) {
    return db.attempts.filter(a => a.set_id === id).sort((a, b) => b.taken_at.localeCompare(a.taken_at));
  }

  function summarize(db, set) {
    const attempts = attemptsFor(db, set.id);
    const best = attempts.length ? Math.max.apply(null, attempts.map(a => Math.round(a.score / a.total * 100))) : null;
    return {
      id: set.id, title: set.title, kind: set.kind, status: set.status, created_at: set.created_at,
      source_label: set.source_label,
      term_count: set.terms ? set.terms.length : 0,
      question_count: set.quiz ? set.quiz.questions.length : 0,
      best_score: best
    };
  }

  function seed(db) {
    if (db.sets.length) return;
    const created = new Date(Date.now() - 2 * 86400000).toISOString();
    db.sets.push(Object.assign({
      id: 'sample-photosynthesis', title: 'Photosynthesis: sample lecture', kind: 'video',
      source_label: 'sample-lecture.mp4', status: 'ready', created_at: created,
      created_ms: Date.now() - 2 * 86400000, num_questions: 6
    }, sampleContent('video', 6)));
  }

  const Demo = {
    async me() { return load().user; },

    async login(body) {
      const email = String(body.email || '').trim().toLowerCase();
      if (!email) throw fail('Enter your email.', 422);
      const db = load();
      const name = (db.user && db.user.email === email && db.user.name) || email.split('@')[0].replace(/[._-]+/g, ' ');
      db.user = { id: 'sample-user', name: name.replace(/\b\w/g, c => c.toUpperCase()), email: email };
      seed(db);
      save(db);
      return db.user;
    },

    async register(body) {
      const email = String(body.email || '').trim().toLowerCase();
      const name = String(body.name || '').trim();
      if (!name || !email) throw fail('Enter your name and email.', 422);
      const db = load();
      db.user = { id: 'sample-user', name: name, email: email };
      seed(db);
      save(db);
      return db.user;
    },

    async logout() {
      const db = load();
      db.user = null;
      save(db);
      return { ok: true };
    },

    async listSets() {
      const db = settle(load());
      const items = db.sets.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).map(s => summarize(db, s));
      const scored = db.attempts.map(a => Math.round(a.score / a.total * 100));
      return {
        items: items,
        stats: {
          sets: items.filter(i => i.status === 'ready').length,
          terms: items.reduce((n, i) => n + i.term_count, 0),
          quizzes_taken: db.attempts.length,
          avg_score: scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null,
          recent_scores: scored.slice(-7)
        }
      };
    },

    async getSet(id) {
      const db = settle(load());
      const set = db.sets.find(s => s.id === id);
      if (!set) throw fail('That study set does not exist or was deleted.', 404);
      return Object.assign({}, set, { attempts: attemptsFor(db, id) });
    },

    async setStatus(id) {
      const db = settle(load());
      const set = db.sets.find(s => s.id === id);
      if (!set) throw fail('That study set does not exist or was deleted.', 404);
      if (set.status === 'ready') {
        const stages = {};
        STAGE_KEYS.forEach(k => { stages[k] = 'done'; });
        return { status: 'ready', stages: stages, current_stage: null };
      }
      const s = stagesFor(set, Date.now());
      return { status: 'processing', stages: s.stages, current_stage: s.current };
    },

    async deleteSet(id) {
      const db = load();
      db.sets = db.sets.filter(s => s.id !== id);
      db.attempts = db.attempts.filter(a => a.set_id !== id);
      save(db);
      return { ok: true };
    },

    async createSet(form, onProgress) {
      const kind = form.get('kind');
      const file = form.get('file');
      const url = form.get('url');
      let title = String(form.get('title') || '').trim();
      let label = '';
      if (kind === 'youtube') { label = String(url || ''); title = title || 'YouTube video'; }
      else { label = file && file.name ? file.name : 'upload'; title = title || titleFromFile(label) || 'Untitled'; }

      for (let p = 0; p <= 1; p += 0.25) { if (onProgress) onProgress(p); await sleep(150); }

      const db = load();
      const set = {
        id: uid(), title: title, kind: kind, source_label: label, status: 'processing',
        created_at: new Date().toISOString(), created_ms: Date.now(),
        num_questions: Number(form.get('num_questions')) || 6
      };
      db.sets.push(set);
      save(db);
      return { id: set.id };
    },

    async saveAttempt(id, body) {
      const db = load();
      db.attempts.push({
        set_id: id, score: body.score, total: body.total, taken_at: new Date().toISOString()
      });
      save(db);
      return { ok: true };
    }
  };

  window.MarginDemo = Demo;
})();
