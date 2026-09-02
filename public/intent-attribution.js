(() => {
  const allowed = {
    landing_intent: ['intent_aave_borrow_rate', 'intent_morpho_vs_aave', 'intent_liquidation_risk'],
    utm_source: ['x', 'intent_aave_borrow_rate', 'intent_morpho_vs_aave', 'intent_liquidation_risk'],
    utm_medium: ['organic', 'landing'],
    utm_campaign: ['realtime_rate_snapshot', 'intent_monitor'],
  };
  const landingIntent = document.body.dataset.landingIntent;
  if (!allowed.landing_intent.includes(landingIntent || '')) return;

  const params = new URLSearchParams(window.location.search);
  const accepted = { landing_intent: landingIntent };
  for (const field of ['utm_source', 'utm_medium', 'utm_campaign']) {
    const value = params.get(field);
    if (value && allowed[field].includes(value)) accepted[field] = value;
  }

  const target = new URL('/', window.location.origin);
  for (const [field, value] of Object.entries(accepted)) target.searchParams.set(field, value);
  const smoke = params.get('smoke') === '1';
  if (smoke) target.searchParams.set('smoke', '1');
  target.hash = 'top';
  const cta = document.querySelector('a.cta');
  if (cta) cta.href = target.href;

  const key = 'debt-saver-public-session';
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(key, sessionId);
  }
  fetch('/api/event', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      event: 'LANDING_VISIT',
      scope: smoke ? 'smoke' : 'live',
      landing_intent: landingIntent,
      utm_source: accepted.utm_source || 'direct',
      utm_medium: accepted.utm_medium || 'none',
      utm_campaign: accepted.utm_campaign || 'none',
      sessionId,
    }),
    keepalive: true,
  }).catch(() => {});
})();
