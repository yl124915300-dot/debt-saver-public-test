(() => {
  const source = document.body.dataset.source;
  if (!/^[a-z0-9_-]{1,64}$/.test(source || '')) return;
  const key = 'debt-saver-public-session';
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(key, sessionId);
  }
  fetch('/api/event', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event: 'VISITOR', scope: 'live', source, sessionId }),
    keepalive: true,
  }).catch(() => {});
})();
