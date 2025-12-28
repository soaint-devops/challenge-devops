'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return { migrationApplied: false };
  }
}

function saveState(state) {
  ensureDataDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function markMigrationApplied() {
  const state = loadState();
  state.migrationApplied = true;
  state.migratedAt = new Date().toISOString();
  saveState(state);
  return state;
}

module.exports = {
  loadState,
  saveState,
  markMigrationApplied,
  DATA_DIR,
  STATE_FILE,
};
