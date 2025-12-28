'use strict';

const { markMigrationApplied, DATA_DIR, STATE_FILE } = require('./state');

function runMigration() {
  const state = markMigrationApplied();
  console.log('Migration applied. State stored at:', STATE_FILE);
  console.log('Data directory:', DATA_DIR);
  console.log('Current state:', state);
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
