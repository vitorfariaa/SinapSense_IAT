// db.js
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'iat.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      image_path TEXT NOT NULL,
      FOREIGN KEY(test_id) REFERENCES tests(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS stimuli (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      valence TEXT NOT NULL CHECK(valence IN ('positive','negative')),
      FOREIGN KEY(test_id) REFERENCES tests(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      cpf_hash TEXT NOT NULL,
      gender TEXT NOT NULL,
      age INTEGER NOT NULL,
      FOREIGN KEY(test_id) REFERENCES tests(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS trials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      brand_id INTEGER NOT NULL,
      stimulus_id INTEGER NOT NULL,
      key TEXT NOT NULL, -- 'E' ou 'O'
      is_positive_response INTEGER NOT NULL, -- 0 ou 1
      response_time_ms INTEGER NOT NULL,
      shown_at TEXT NOT NULL,
      prime_duration_ms INTEGER NOT NULL,
      FOREIGN KEY(run_id) REFERENCES runs(id),
      FOREIGN KEY(brand_id) REFERENCES brands(id),
      FOREIGN KEY(stimulus_id) REFERENCES stimuli(id)
    )
  `);
});

module.exports = db;
