import { json, type PagesContext } from '../_shared.js';

export function onRequestGet(context: PagesContext) {
  return json({
    status: 'ok',
    mode: 'public-read-only-test',
    writes: false,
    walletConnection: false,
    calldata: false,
    signing: false,
    broadcast: false,
    mainnetDeployment: false,
    gasSpend: false,
    analytics: context.env.DB ? 'anonymous-aggregate' : 'unavailable-fail-closed',
    liveScope: ['Ethereum', 'Morpho Blue', 'Aave V3'],
    quoteSource: 'live-aave-v3-ethereum-fixed-block',
  });
}
