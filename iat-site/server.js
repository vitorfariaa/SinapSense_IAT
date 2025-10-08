// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');
const db = require('./db');

const app = express();
const PORT = 3000;

// uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const base = path.basename(file.originalname || 'img', ext).replace(/\W+/g, '_');
    cb(null, base + '_' + Date.now() + ext);
  }
});
const upload = multer({ storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsDir));
app.use((req, res, next) => {
  if (/\.(js|css|html)$/.test(req.path)) {
    res.set('Cache-Control', 'no-store');
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// util
const nowISO = () => new Date().toISOString();
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

// ---------- API ----------

// listar testes
app.get('/api/tests', (req, res) => {
  db.all('SELECT id, name, created_at FROM tests ORDER BY id DESC', [], (err, tests) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(tests);
  });
});

// obter teste completo
app.get('/api/tests/:id', (req, res) => {
  const id = Number(req.params.id);
  db.get('SELECT * FROM tests WHERE id = ?', [id], (err, test) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!test) return res.status(404).json({ error: 'Teste não encontrado' });

    db.all('SELECT * FROM brands WHERE test_id = ? ORDER BY id ASC', [id], (err2, brands) => {
      if (err2) return res.status(500).json({ error: err2.message });
      db.all('SELECT * FROM stimuli WHERE test_id = ? ORDER BY id ASC', [id], (err3, stimuli) => {
        if (err3) return res.status(500).json({ error: err3.message });
        res.json({ test, brands, stimuli });
      });
    });
  });
});

// criar teste (com upload de duas imagens OU URLs)
const fields = upload.fields([{ name: 'brandAImage', maxCount: 1 }, { name: 'brandBImage', maxCount: 1 }]);
app.post('/api/tests', fields, (req, res) => {
  try {
    const { name, brandAName, brandBName, brandAImageUrl, brandBImageUrl, stimuliJson } = req.body;
    if (!name || !brandAName || !brandBName || !stimuliJson) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
    }
    const stimuli = JSON.parse(stimuliJson);
    if (!Array.isArray(stimuli) || stimuli.length === 0) {
      return res.status(400).json({ error: 'Lista de estímulos inválida' });
    }
    const brandAFile = req.files['brandAImage']?.[0];
    const brandBFile = req.files['brandBImage']?.[0];

    const brandAPath = brandAFile ? '/uploads/' + brandAFile.filename : (brandAImageUrl || '');
    const brandBPath = brandBFile ? '/uploads/' + brandBFile.filename : (brandBImageUrl || '');
    if (!brandAPath || !brandBPath) {
      return res.status(400).json({ error: 'Imagem da marca A e B são obrigatórias (arquivo ou URL)' });
    }

    db.run(
      'INSERT INTO tests (name, created_at) VALUES (?, ?)',
      [name, nowISO()],
      function onInserted(err) {
        if (err) return res.status(500).json({ error: err.message });
        const testId = this.lastID;

        db.run('INSERT INTO brands (test_id, name, image_path) VALUES (?, ?, ?)', [testId, brandAName, brandAPath]);
        db.run('INSERT INTO brands (test_id, name, image_path) VALUES (?, ?, ?)', [testId, brandBName, brandBPath]);

        const stmt = db.prepare('INSERT INTO stimuli (test_id, text, valence) VALUES (?, ?, ?)');
        for (const st of stimuli) {
          const val = st.valence === 'positive' ? 'positive' : 'negative';
          stmt.run([testId, st.text, val]);
        }
        stmt.finalize(err2 => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ ok: true, testId });
        });
      }
    );
  } catch (e) {
    res.status(400).json({ error: 'Payload inválido: ' + e.message });
  }
});

// iniciar execução (run)
app.post('/api/runs', (req, res) => {
  const { testId, cpf, gender, age } = req.body;
  if (!testId || !cpf || !gender || !age) {
    return res.status(400).json({ error: 'Parâmetros obrigatórios: testId, cpf, gender, age' });
  }
  const cpfHash = sha256(String(cpf).trim());
  db.run(
    'INSERT INTO runs (test_id, started_at, cpf_hash, gender, age) VALUES (?, ?, ?, ?, ?)',
    [testId, nowISO(), cpfHash, String(gender), Number(age)],
    function onInserted(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ runId: this.lastID });
    }
  );
});

// enviar tentativas (trials) de uma execução
app.post('/api/runs/:id/trials', (req, res) => {
  const runId = Number(req.params.id);
  const { trials } = req.body;
  if (!Array.isArray(trials) || trials.length === 0) {
    return res.status(400).json({ error: 'Lista de trials vazia' });
  }
  const stmt = db.prepare(`
    INSERT INTO trials (run_id, brand_id, stimulus_id, key, is_positive_response, response_time_ms, shown_at, prime_duration_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const t of trials) {
    stmt.run([
      runId,
      t.brandId,
      t.stimulusId,
      t.key,
      t.isPositiveResponse ? 1 : 0,
      t.responseTimeMs,
      t.shownAt || nowISO(),
      t.primeDurationMs || 300
    ]);
  }
  stmt.finalize(err => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, saved: trials.length });
  });
});

// resumo de uma execução
app.get('/api/runs/:id/summary', (req, res) => {
  const runId = Number(req.params.id);
  const sql = `
    SELECT b.name AS brand, s.valence AS stimulus_valence,
           SUM(CASE WHEN t.is_positive_response=1 THEN 1 ELSE 0 END) AS positive_responses,
           COUNT(*) AS total,
           AVG(CASE WHEN t.is_positive_response=1 THEN t.response_time_ms END) AS avg_rt_positive,
           AVG(t.response_time_ms) AS avg_rt_all
    FROM trials t
    JOIN brands b ON b.id = t.brand_id
    JOIN stimuli s ON s.id = t.stimulus_id
    WHERE t.run_id = ?
    GROUP BY b.name, s.valence
    ORDER BY b.name, s.valence
  `;
  db.all(sql, [runId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ runId, summary: rows });
  });
});

app.listen(PORT, () => {
  console.log('IAT server rodando em http://localhost:' + PORT);
});

// Lista as execuções (runs) de um teste
app.get('/api/tests/:id/runs', (req, res) => {
  const testId = Number(req.params.id);
  const sql = `
    SELECT id, started_at, gender, age
    FROM runs
    WHERE test_id = ?
    ORDER BY id DESC
  `;
  db.all(sql, [testId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ testId, runs: rows });
  });
});

// Resumo agregado de um teste (todas as execuções)
app.get('/api/tests/:id/summary', (req, res) => {
  const testId = Number(req.params.id);
  const sql = `
    SELECT b.name AS brand,
           s.valence AS stimulus_valence,
           SUM(CASE WHEN t.is_positive_response=1 THEN 1 ELSE 0 END) AS positive_responses,
           SUM(CASE WHEN t.is_positive_response=0 THEN 1 ELSE 0 END) AS negative_responses,
           COUNT(*) AS total,
           AVG(CASE WHEN ((t.is_positive_response=1 AND s.valence='positive') OR (t.is_positive_response=0 AND s.valence='negative')) THEN t.response_time_ms END) AS avg_rt_correct,
           AVG(t.response_time_ms) AS avg_rt_all,
           SUM(CASE WHEN ((t.is_positive_response=1 AND s.valence='positive') OR (t.is_positive_response=0 AND s.valence='negative')) THEN 0 ELSE 1 END) * 1.0 / COUNT(*) AS error_rate
    FROM trials t
    JOIN runs r     ON r.id = t.run_id
    JOIN brands b   ON b.id = t.brand_id
    JOIN stimuli s  ON s.id = t.stimulus_id
    WHERE r.test_id = ?
    GROUP BY b.name, s.valence
    ORDER BY b.name, s.valence
  `;
  db.all(sql, [testId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ testId, summary: rows });
  });
});

// Detalhe dos trials de uma execução (útil p/ debug/inspeção)
app.get('/api/runs/:id/trials', (req, res) => {
  const runId = Number(req.params.id);
  const sql = `
    SELECT t.id AS trial_id, t.run_id, b.name AS brand, s.text AS stimulus_text, s.valence AS stimulus_valence,
           t.key, t.is_positive_response, t.response_time_ms, t.shown_at, t.prime_duration_ms
    FROM trials t
    JOIN brands b  ON b.id = t.brand_id
    JOIN stimuli s ON s.id = t.stimulus_id
    WHERE t.run_id = ?
    ORDER BY t.id
  `;
  db.all(sql, [runId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ runId, trials: rows });
  });
});

// Exporta CSV de todos os trials de um teste
app.get('/api/tests/:id/csv', (req, res) => {
  const testId = Number(req.params.id);
  const sql = `
    SELECT t.id AS trial_id,
           r.id AS run_id, r.started_at, r.gender, r.age,
           b.name AS brand,
           s.text AS stimulus_text, s.valence AS stimulus_valence,
           t.key, t.is_positive_response, t.response_time_ms, t.shown_at, t.prime_duration_ms
    FROM trials t
    JOIN runs r     ON r.id = t.run_id
    JOIN brands b   ON b.id = t.brand_id
    JOIN stimuli s  ON s.id = t.stimulus_id
    WHERE r.test_id = ?
    ORDER BY r.id, t.id
  `;
  db.all(sql, [testId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const fields = [
      'trial_id','run_id','started_at','gender','age',
      'brand','stimulus_text','stimulus_valence',
      'key','is_positive_response','response_time_ms','shown_at','prime_duration_ms'
    ];
    const esc = v => {
      if (v === null || v === undefined) return '';
      v = String(v);
      return (v.includes('"') || v.includes(',') || v.includes('\n'))
        ? '"' + v.replace(/"/g, '""') + '"'
        : v;
    };
    const header = fields.join(',');
    const lines = rows.map(r => fields.map(f => esc(r[f])).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="test_' + testId + '_trials.csv"');
    res.send([header, ...lines].join('\n'));
  });
});