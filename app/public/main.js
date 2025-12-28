let token = null;
let todosState = [];

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body.error || res.statusText;
    throw new Error(msg);
  }
  return body;
}

async function refresh() {
  try {
    const health = await fetchJson('/health');
    document.getElementById('health').textContent = `API healthy: ${health.status}`;

    const message = await fetchJson('/api/message');
    document.getElementById('message').textContent = message.message;

    if (token) {
      const todos = await fetchJson('/api/todos', {
        headers: { Authorization: `Bearer ${token}` },
      });
      todosState = todos.todos || [];
      renderTodos(todosState);
      updateCompleteButton();
    } else {
      todosState = [];
      renderTodos([]);
      updateCompleteButton();
    }
    setError('');
  } catch (err) {
    setError(err.message || 'Unexpected error');
  }
}

function renderTodos(todos) {
  const container = document.getElementById('todos');
  container.innerHTML = '';
  todos.forEach((todo) => {
    const item = document.createElement('div');
    item.className = 'todo';
    const title = document.createElement('span');
    title.innerHTML = `<strong>${todo.done ? '✅' : '⬜️'} ${todo.title}</strong><br/><small>${
      todo.detail || ''
    }</small>`;
    const toggle = document.createElement('button');
    toggle.textContent = todo.done ? 'Done' : 'Pending';
    toggle.disabled = true;
    item.appendChild(title);
    item.appendChild(toggle);
    container.appendChild(item);
  });
}

function setError(msg) {
  document.getElementById('error').textContent = msg;
}

document.getElementById('new-todo-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  setError('Los todos son automáticos; no puedes crear nuevos para este reto.');
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  if (!username || !password) return;
  try {
    const result = await fetchJson('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    token = result.token;
    document.getElementById('login-status').textContent = 'Logged in';
    setError('');
    await refresh();
  } catch (err) {
    setError(err.message || 'Login failed');
  }
});

document.getElementById('complete-btn').addEventListener('click', async () => {
  if (!token) return;
  await requestCompletionCode();
});

refresh();

async function requestCompletionCode() {
  try {
    const result = await fetchJson('/api/complete', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    document.getElementById('completion-code').textContent = result.code;
    setError('');
  } catch (err) {
    setError(err.message || 'Completion check failed');
  }
}

function updateCompleteButton() {
  const btn = document.getElementById('complete-btn');
  if (!btn) return;
  const allDone = todosState.length > 0 && todosState.every((t) => t.done);
  btn.disabled = !token || !allDone;
}
