'use strict';

const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { generateCredentials } = require('./secrets');
const { loadState } = require('./state');

const port = process.env.PORT;
const message = process.env.MESSAGE || 'Hello from docker compose';
const credentialsSecret = process.env.CREDENTIALS_SECRET;
const completionSecret = process.env.COMPLETION_SECRET;
const imageLabel = process.env.CHALLENGE_IMAGE_LABEL || '';
const netAlias = process.env.NET_ALIAS || '';

if (!port) {
  throw new Error('PORT environment variable is required for the server to start');
}

if (!credentialsSecret) {
  throw new Error('CREDENTIALS_SECRET environment variable is required to create login credentials');
}

if (!completionSecret) {
  throw new Error('COMPLETION_SECRET environment variable is required to generate completion codes');
}

const generatedCreds = generateCredentials(credentialsSecret);
console.log(
  `[CREDENTIALS READY] username=${generatedCreds.username} password=${generatedCreds.password}`
);
console.log(`[CREDENTIALS ENCRYPTED] ${JSON.stringify(generatedCreds.encrypted)}`);

let state = loadState();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const activeTokens = new Set();

const wordBank = ['aurora', 'comet', 'zenith', 'solstice', 'nebula', 'horizon'];
const timeSlot = () => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const hour = now.getUTCHours().toString().padStart(2, '0');
  const quarter = Math.floor(now.getUTCMinutes() / 15);
  return { date, hour, quarter };
};

const toSerial = (buffer) => {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let bits = '';
  buffer.forEach((byte) => {
    bits += byte.toString(2).padStart(8, '0');
  });
  let out = '';
  for (let i = 0; i + 5 <= bits.length && out.length < 25; i += 5) {
    const chunk = bits.slice(i, i + 5);
    out += alphabet[parseInt(chunk, 2)];
  }
  return `${out.slice(0, 5)}-${out.slice(5, 10)}-${out.slice(10, 15)}-${out.slice(15, 20)}-${out.slice(20, 25)}`;
};

const generateCompletionCode = () => {
  const { date, hour, quarter } = timeSlot();
  const slot = `${date}-H${hour}Q${quarter}`;
  const word = wordBank[(parseInt(hour, 10) + quarter) % wordBank.length];
  const hmac = crypto.createHmac('sha256', completionSecret).update(slot).digest();
  const serial = toSerial(hmac);
  return `DONE-${slot}-${word}-${serial}`;
};

const evaluateTasks = () => {
  state = loadState();
  const tfPath = path.join(__dirname, '..', 'infra', 'main.tf');
  let tfDone = false;
  let tfDetail = 'terraform file missing';
  try {
    const tfContent = fs.readFileSync(tfPath, 'utf8');
    const hasNull = tfContent.includes('resource "null_resource" "challenge"');
    const hasVersion = tfContent.includes('required_version');
    const hasTodo = tfContent.includes('TODO');
    if (hasNull && hasVersion && !hasTodo) {
      tfDone = true;
      tfDetail = 'infra/main.tf present';
    } else {
      tfDetail = 'terraform file incomplete';
    }
  } catch (err) {
    tfDone = false;
    tfDetail = 'terraform file missing';
  }
  const tasks = [
    {
      key: 'dockerfile',
      title: 'Arreglar Dockerfile (CHALLENGE_IMAGE_LABEL=dockerfile-fixed)',
      done: imageLabel === 'dockerfile-fixed',
      detail: `CHALLENGE_IMAGE_LABEL=${imageLabel || 'missing'}`,
    },
    {
      key: 'network',
      title: 'Configurar red/alias en docker compose (NET_ALIAS=app.local)',
      done: netAlias === 'app.local',
      detail: `NET_ALIAS=${netAlias || 'missing'}`,
    },
    {
      key: 'migration',
      title: 'Ejecutar migración (npm run migrate)',
      done: Boolean(state.migrationApplied),
      detail: state.migrationApplied ? `migratedAt=${state.migratedAt}` : 'migration not run',
    },
    {
      key: 'terraform',
      title: 'Completar infraestructura Terraform',
      done: tfDone,
      detail: tfDetail,
    },
    {
      key: 'message',
      title: 'Personalizar mensaje (MESSAGE no puede ser el valor por defecto)',
      done: message !== 'Hello from docker compose',
      detail: `MESSAGE=${message}`,
    },
  ];
  const allDone = tasks.every((t) => t.done);
  return { tasks, allDone };
};

app.get('/health', (req, res) => {
  res.json({ status: 'ok', checks: evaluateTasks() });
});

app.get('/api/message', (req, res) => {
  res.json({ message });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username !== generatedCreds.username || password !== generatedCreds.password) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  const token = crypto.randomBytes(16).toString('hex');
  activeTokens.add(token);
  console.log(`[ACCESS GRANTED] user=${username}`);
  res.json({ token });
});

const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.replace('Bearer ', '') : null;
  if (!token || !activeTokens.has(token)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
};

app.get('/api/todos', requireAuth, (req, res) => {
  const { tasks } = evaluateTasks();
  res.json({ todos: tasks });
});

app.post('/api/todos', requireAuth, (req, res) => {
  res.status(400).json({ error: 'auto_managed', message: 'Todos se gestionan automáticamente' });
});

app.post('/api/todos/:id/toggle', requireAuth, (req, res) => {
  res
    .status(400)
    .json({ error: 'auto_managed', message: 'No puedes cambiar manualmente el estado' });
});

app.post('/api/complete', requireAuth, (req, res) => {
  const { tasks, allDone } = evaluateTasks();
  if (!allDone) {
    const pending = tasks.filter((t) => !t.done).map((t) => t.key);
    return res.status(400).json({ error: 'tasks_pending', pending });
  }
  const code = generateCompletionCode();
  console.log(`[CHALLENGE COMPLETED] code=${code}`);
  res.json({ code });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`API + UI listening on port ${port}`);
});
