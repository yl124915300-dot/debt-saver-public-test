import { useEffect, useState, type FormEvent } from 'react';
import { Metric } from './components/Metric';
import { getPublicSessionId, getPublicSource, recordPublicEvent } from './services/publicAnalytics';
import type { PublicScanResponse } from './services/publicTypes';

const money = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

export function App() {
  const [wallet, setWallet] = useState('');
  const [result, setResult] = useState<PublicScanResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const smokeTest = new URLSearchParams(window.location.search).get('smoke') === '1';
  const publicSource = getPublicSource();

  useEffect(() => { void recordPublicEvent('VISITOR', smokeTest ? 'smoke' : 'live'); }, [smokeTest]);

  useEffect(() => {
    if (result?.mode === 'reviewed-snapshot-demo' && result.quoteReady) {
      void recordPublicEvent('QUOTE_VIEWED', smokeTest ? 'smoke' : 'demo');
    }
  }, [result, smokeTest]);

  async function request(payload: Record<string, string>) {
    const response = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...payload, sessionId: getPublicSessionId(), source: publicSource, analyticsScope: smokeTest ? 'smoke' : '' }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? 'Read-only scan failed closed.');
    return body as PublicScanResponse;
  }

  async function evaluate(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError('');
    setReviewed(false);
    try {
      setResult(await request({ wallet }));
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : 'Read-only scan failed closed.');
    } finally {
      setLoading(false);
    }
  }

  async function loadDemo() {
    setLoading(true);
    setError('');
    setReviewed(false);
    try {
      setResult(await request({ demo: 'top1' }));
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : 'Demo unavailable.');
    } finally {
      setLoading(false);
    }
  }

  async function openReviewPreview() {
    if (!result?.quote) return;
    setLoading(true);
    try {
      const response = await fetch('/api/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quoteId: result.quote.id, sessionId: getPublicSessionId(), analyticsScope: smokeTest ? 'smoke' : '' }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Preview unavailable.');
      setReviewed(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Preview unavailable.');
    } finally {
      setLoading(false);
    }
  }

  const topPosition = result?.positions[0];

  return (
    <div className="app-shell">
      <div className="test-banner">READ-ONLY PUBLIC TEST · NO WALLET SIGNING · NO TRANSACTIONS · NO GAS</div>
      <header className="header">
        <a className="brand" href="#top" aria-label="Debt Saver home">
          <span className="brand__mark">DS</span>
          <span><strong>Debt Saver</strong><small>Ethereum · Public test mode</small></span>
        </a>
        <div className="header__status"><i /> Read-only · Fail-closed</div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero__eyebrow">PUBLIC READ-ONLY DEBT CHECK</div>
          <h1>Could your DeFi debt<br /><em>cost less?</em></h1>
          <p>Enter your wallet address to check whether your DeFi debt can be refinanced cheaper. The public test reads Morpho Blue on Ethereum only and never connects to, signs with, or writes from your wallet.</p>

          <form className="search" onSubmit={evaluate}>
            <label htmlFor="wallet">Public wallet address</label>
            <div className="search__row">
              <input id="wallet" value={wallet} onChange={(event) => setWallet(event.target.value)} placeholder="0x…" spellCheck={false} autoComplete="off" />
              <button className="button button--primary" disabled={loading || !wallet.trim()}>{loading ? 'Reading…' : 'Check debt read-only'}</button>
            </div>
            <div className="demo-links">
              <span>Or inspect the clearly labeled reviewed snapshot:</span>
              <button type="button" onClick={loadDemo} disabled={loading}>Open Top 1 demo</button>
            </div>
          </form>
          <p className="privacy-inline">We do not store submitted addresses. The server sends the address to Morpho's public API for the requested read. Anonymous funnel events contain no wallet address, IP address, cookies, signatures, or personal profile.</p>
          {error && <div className="notice notice--error"><strong>Fail-closed:</strong> {error} No quote was created.</div>}
        </section>

        {result && (
          <section className="result" aria-live="polite">
            <div className="mode-strip">
              <span className={`pill ${result.mode === 'reviewed-snapshot-demo' ? 'pill--warning' : 'pill--positive'}`}>
                {result.mode === 'reviewed-snapshot-demo' ? 'Reviewed snapshot demo · not live' : 'Live read · quote source unavailable'}
              </span>
              <span>Checked {new Date(result.scannedAt).toLocaleString()}</span>
            </div>

            {result.status === 'DEMO_QUOTE_READY' && result.quote && topPosition ? (
              <>
                <div className="result__heading">
                  <div>
                    <span className="pill pill--warning">Expired historical model</span>
                    <h2>Morpho → Aave</h2>
                    <p>{topPosition.collateralAsset} collateral · {topPosition.debtAsset} debt · {result.quote.horizonDays}-day saved model</p>
                  </div>
                  <div className="result__proof"><span>Reviewed fixed-block evidence</span><strong>Block {result.indexedBlock?.toLocaleString()} · {result.simulation?.mainAssertions}</strong></div>
                </div>
                <div className="metrics">
                  <Metric label="Snapshot Debt" value={money(result.quote.position.debtUsd)} hint="Not current" />
                  <Metric label="Snapshot APR" value={`${result.quote.position.currentApr.toFixed(4)}%`} hint="Not current" />
                  <Metric label="Modeled Route" value={`${result.quote.betterApr.toFixed(4)}%`} tone="positive" hint="Not current" />
                  <Metric label="Modeled Gross" value={money(result.quote.grossSavingUsd)} tone="accent" hint={`${result.quote.horizonDays} days`} />
                  <Metric label="Modeled Fee" value={money(result.quote.feeUsd)} hint="No fee is due in test mode" />
                  <Metric label="Modeled Net" value={money(result.quote.netSavingUsd)} tone="positive" hint="Historical only" />
                </div>
                <div className="notice notice--warning"><strong>Demo boundary:</strong> {result.limitation}</div>
                <div className="explanation"><div className="explanation__icon">i</div><p>{result.explanation}</p></div>
                <div className="review-bar">
                  <div><strong>Read-only explanation package</strong><span>No approval, calldata, delegation, signature, transaction, deployment, fee, or gas action exists.</span></div>
                  <button className="button button--secondary" onClick={openReviewPreview} disabled={loading || reviewed}>{reviewed ? 'Preview opened ✓' : 'Open read-only review preview'}</button>
                </div>
                {reviewed && <div className="notice notice--success">Preview recorded. Nothing was generated that can be signed or broadcast.</div>}
              </>
            ) : result.status === 'DEBT_FOUND_NO_QUOTE' && topPosition ? (
              <div className="live-result">
                <span className="pill pill--positive">Morpho debt found</span>
                <h2>{money(result.positions.reduce((sum, position) => sum + position.debtUsd, 0))} detected</h2>
                <p>{result.positions.length} Ethereum Morpho Blue borrow position{result.positions.length === 1 ? '' : 's'} found from the live public index.</p>
                <div className="metrics metrics--compact">
                  <Metric label="Largest Debt" value={money(topPosition.debtUsd)} hint={topPosition.debtAsset} />
                  <Metric label="Current Borrow APY" value={`${topPosition.currentApr.toFixed(4)}%`} hint="Morpho live index" />
                  <Metric label="Collateral" value={topPosition.collateralAsset} hint="Largest market" />
                </div>
                <div className="notice notice--warning"><strong>No live refinance quote:</strong> {result.limitation}</div>
              </div>
            ) : (
              <div className="competitive">
                <span className="competitive__icon">—</span>
                <div><span className="pill">No supported debt found</span><h2>No active Morpho Blue debt detected</h2><p>{result.explanation}</p></div>
              </div>
            )}
          </section>
        )}

        <section className="trust-grid">
          <article><span>01</span><h3>Read-only by construction</h3><p>No wallet connector, approvals, signatures, calldata builder, broadcaster, deployed migrator, or gas-spending path is present.</p></article>
          <article><span>02</span><h3>Quote or fail closed</h3><p>Live Morpho debt can be detected. Until the comparison source is reviewed and available, the public test refuses to manufacture a refinance quote.</p></article>
          <article><span>03</span><h3>Minimal anonymous measurement</h3><p>Only funnel stage, test scope, day, and a one-way random session hash are retained. Wallet addresses are never written to analytics.</p></article>
        </section>

        <section className="limitations">
          <h2>Public test limitations</h2>
          <p>Ethereum Morpho Blue only. Data comes from Morpho's public indexed API and may lag the chain. Aave comparison is intentionally unavailable, so real-address scans do not produce QUOTE_READY. This is not financial advice.</p>
          <p>Report abuse or security issues through the <a href="https://github.com/yl124915300-dot/debt-saver-public-test/issues" target="_blank" rel="noreferrer">public issue tracker</a>. Do not include private keys, seed phrases, signatures, or personal information.</p>
        </section>

        <nav className="intent-links" aria-label="Debt Saver intent guides">
          <span>Read-only debt checks:</span>
          <a href="/aave-borrow-rate/">Aave borrow rate</a>
          <a href="/morpho-vs-aave/">Morpho vs Aave</a>
          <a href="/defi-liquidation-risk/">Liquidation risk</a>
        </nav>
      </main>

      <footer><span>Debt Saver · read-only public test</span><span>No mainnet writes · No calldata · No financial advice</span></footer>
    </div>
  );
}
