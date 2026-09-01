import { decodeFunctionResult, encodeFunctionData, getAddress, parseAbi, type Address, type Hex } from 'viem';
import type { DataProof, LiveDebtPosition } from './publicTypes.js';

export const AAVE_ADDRESSES_PROVIDER = getAddress('0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e');
export const AAVE_POOL = getAddress('0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2');
export const AAVE_DATA_PROVIDER = getAddress('0x0a16f2FCC0D44FaE41cc54e079281D84A363bECD');
export const AAVE_ORACLE = getAddress('0x54586bE62E3c3580375aE3723C145253060Ca0C2');
export const MORPHO_BLUE = getAddress('0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb');
export const WETH = getAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2');
export const RPC_ENDPOINTS = ['https://ethereum-rpc.publicnode.com', 'https://eth.llamarpc.com'] as const;
export const MAX_CHAIN_AGE_SECONDS = 180;

const providerAbi = parseAbi(['function getPool() view returns (address)', 'function getPriceOracle() view returns (address)']);
const dataAbi = parseAbi([
  'function getReserveData(address asset) view returns (uint256 unbacked,uint256 accruedToTreasuryScaled,uint256 totalAToken,uint256 totalStableDebt,uint256 totalVariableDebt,uint256 liquidityRate,uint256 variableBorrowRate,uint256 stableBorrowRate,uint256 averageStableBorrowRate,uint256 liquidityIndex,uint256 variableBorrowIndex,uint40 lastUpdateTimestamp)',
  'function getReserveConfigurationData(address asset) view returns (uint256 decimals,uint256 ltv,uint256 liquidationThreshold,uint256 liquidationBonus,uint256 reserveFactor,bool usageAsCollateralEnabled,bool borrowingEnabled,bool stableBorrowRateEnabled,bool isActive,bool isFrozen)',
  'function getReserveCaps(address asset) view returns (uint256 borrowCap,uint256 supplyCap)',
  'function getDebtCeiling(address asset) view returns (uint256)',
  'function getSiloedBorrowing(address asset) view returns (bool)',
]);
const oracleAbi = parseAbi(['function getAssetPrice(address asset) view returns (uint256)', 'function BASE_CURRENCY_UNIT() view returns (uint256)']);
const poolAbi = parseAbi([
  'function FLASHLOAN_PREMIUM_TOTAL() view returns (uint128)',
  'function getUserAccountData(address user) view returns (uint256 totalCollateralBase,uint256 totalDebtBase,uint256 availableBorrowsBase,uint256 currentLiquidationThreshold,uint256 ltv,uint256 healthFactor)',
  'function getUserEMode(address user) view returns (uint256)',
]);
const erc20Abi = parseAbi(['function balanceOf(address account) view returns (uint256)']);

interface RpcBlock { number: Hex; hash: Hex; timestamp: Hex }
interface RpcResult<T> { jsonrpc: '2.0'; id: number; result?: T; error?: { message?: string } }

async function rpc<T>(endpoint: string, method: string, params: unknown[], fetcher: typeof fetch): Promise<T> {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 9_000);
  try {
    const response = await fetcher(endpoint, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: controller.signal });
    if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
    const body = await response.json() as RpcResult<T>;
    if (body.error || body.result === undefined) throw new Error(body.error?.message ?? 'RPC returned no result');
    return body.result;
  } finally { clearTimeout(timeout); }
}

async function readContract<T>(endpoint: string, address: Address, abi: readonly unknown[], functionName: string, args: readonly unknown[] | undefined, blockTag: Hex, fetcher: typeof fetch): Promise<T> {
  const data = encodeFunctionData({ abi: abi as never, functionName, args } as never);
  const result = await rpc<Hex>(endpoint, 'eth_call', [{ to: address, data }, blockTag], fetcher);
  return decodeFunctionResult({ abi: abi as never, functionName, data: result } as never) as T;
}

export interface AaveSnapshot {
  proof: DataProof;
  witnessHeads: number[];
  debtPriceUsd: number;
  collateralPriceUsd: number;
  nativePriceUsd: number;
  debtDecimals: number;
  collateralDecimals: number;
  variableBorrowApr: number;
  variableBorrowApy: number;
  ltv: number;
  liquidationThreshold: number;
  availableLiquidityAssets: bigint;
  borrowCapHeadroomAssets: bigint | null;
  supplyCapHeadroomAssets: bigint | null;
  collateralEnabled: boolean;
  borrowingEnabled: boolean;
  debtReserveActive: boolean;
  debtReserveFrozen: boolean;
  collateralReserveActive: boolean;
  collateralReserveFrozen: boolean;
  collateralDebtCeiling: bigint;
  siloedBorrowing: boolean;
  morphoFlashLiquidityAssets: bigint;
  aaveFlashPremiumBps: number;
  gasPriceWei: bigint;
  existingCollateralUsd: number;
  existingDebtUsd: number;
  existingLiquidationThreshold: number;
  existingHealthFactor: number | null;
  userEMode: number;
}

function asTuple(value: unknown): readonly unknown[] { if (!Array.isArray(value)) throw new Error('Aave contract returned an invalid tuple.'); return value; }
function capUnits(cap: bigint, decimals: number) { return cap === 0n ? null : cap * 10n ** BigInt(decimals); }

export async function readAaveSnapshot(position: LiveDebtPosition, wallet: Address, fetcher: typeof fetch = fetch, nowMs = Date.now()): Promise<AaveSnapshot> {
  const heads = await Promise.all(RPC_ENDPOINTS.map(async (endpoint) => {
    try {
      const [chainId, block] = await Promise.all([rpc<Hex>(endpoint, 'eth_chainId', [], fetcher), rpc<RpcBlock>(endpoint, 'eth_getBlockByNumber', ['latest', false], fetcher)]);
      if (Number.parseInt(chainId, 16) !== 1) throw new Error('wrong chain');
      return { endpoint, block, number: Number.parseInt(block.number, 16), timestamp: Number.parseInt(block.timestamp, 16) };
    } catch { return null; }
  }));
  const valid = heads.filter((head): head is NonNullable<typeof head> => head !== null).sort((a, b) => b.number - a.number);
  if (!valid.length) throw new Error('No verified Ethereum RPC source is available.');
  if (valid.length > 1 && valid[0].number - valid.at(-1)!.number > 6) throw new Error('Ethereum RPC heads disagree.');
  const selected = valid.at(-1)!;
  if (Math.abs(nowMs / 1000 - selected.timestamp) > MAX_CHAIN_AGE_SECONDS) throw new Error('Ethereum block data is stale.');
  const blockTag = selected.block.number;
  const readEndpoints = [selected.endpoint, ...valid.map((head) => head.endpoint).filter((endpoint) => endpoint !== selected.endpoint)];
  const call = async <T>(address: Address, abi: readonly unknown[], functionName: string, args?: readonly unknown[]) => {
    let lastError: unknown;
    for (const endpoint of readEndpoints) {
      try { return await readContract<T>(endpoint, address, abi, functionName, args, blockTag, fetcher); } catch (error) { lastError = error; }
    }
    throw lastError instanceof Error ? lastError : new Error('All Ethereum RPC reads failed.');
  };
  const gasPrice = async () => {
    let lastError: unknown;
    for (const endpoint of readEndpoints) {
      try { return await rpc<Hex>(endpoint, 'eth_gasPrice', [], fetcher); } catch (error) { lastError = error; }
    }
    throw lastError instanceof Error ? lastError : new Error('All Ethereum gas-price reads failed.');
  };
  const [pool, oracle, debtDataRaw, collateralDataRaw, debtConfigRaw, collateralConfigRaw, debtCapsRaw, collateralCapsRaw, debtCeiling, siloedBorrowing, debtPriceRaw, collateralPriceRaw, nativePriceRaw, baseUnitRaw, flashPremiumRaw, morphoFlashLiquidity, accountDataRaw, userEModeRaw, gasPriceHex] = await Promise.all([
    call<Address>(AAVE_ADDRESSES_PROVIDER, providerAbi, 'getPool'), call<Address>(AAVE_ADDRESSES_PROVIDER, providerAbi, 'getPriceOracle'),
    call<readonly unknown[]>(AAVE_DATA_PROVIDER, dataAbi, 'getReserveData', [position.debtAssetAddress]), call<readonly unknown[]>(AAVE_DATA_PROVIDER, dataAbi, 'getReserveData', [position.collateralAssetAddress]),
    call<readonly unknown[]>(AAVE_DATA_PROVIDER, dataAbi, 'getReserveConfigurationData', [position.debtAssetAddress]), call<readonly unknown[]>(AAVE_DATA_PROVIDER, dataAbi, 'getReserveConfigurationData', [position.collateralAssetAddress]),
    call<readonly unknown[]>(AAVE_DATA_PROVIDER, dataAbi, 'getReserveCaps', [position.debtAssetAddress]), call<readonly unknown[]>(AAVE_DATA_PROVIDER, dataAbi, 'getReserveCaps', [position.collateralAssetAddress]),
    call<bigint>(AAVE_DATA_PROVIDER, dataAbi, 'getDebtCeiling', [position.collateralAssetAddress]), call<boolean>(AAVE_DATA_PROVIDER, dataAbi, 'getSiloedBorrowing', [position.debtAssetAddress]),
    call<bigint>(AAVE_ORACLE, oracleAbi, 'getAssetPrice', [position.debtAssetAddress]), call<bigint>(AAVE_ORACLE, oracleAbi, 'getAssetPrice', [position.collateralAssetAddress]),
    call<bigint>(AAVE_ORACLE, oracleAbi, 'getAssetPrice', [WETH]), call<bigint>(AAVE_ORACLE, oracleAbi, 'BASE_CURRENCY_UNIT'),
    call<bigint>(AAVE_POOL, poolAbi, 'FLASHLOAN_PREMIUM_TOTAL'), call<bigint>(position.debtAssetAddress, erc20Abi, 'balanceOf', [MORPHO_BLUE]),
    call<readonly unknown[]>(AAVE_POOL, poolAbi, 'getUserAccountData', [wallet]), call<bigint>(AAVE_POOL, poolAbi, 'getUserEMode', [wallet]), gasPrice(),
  ]);
  if (getAddress(pool) !== AAVE_POOL || getAddress(oracle) !== AAVE_ORACLE) throw new Error('Aave address-provider verification failed.');
  const debtData = asTuple(debtDataRaw); const collateralData = asTuple(collateralDataRaw); const debtConfig = asTuple(debtConfigRaw); const collateralConfig = asTuple(collateralConfigRaw);
  const debtCaps = asTuple(debtCapsRaw); const collateralCaps = asTuple(collateralCapsRaw);
  const accountData = asTuple(accountDataRaw);
  const debtDecimals = Number(debtConfig[0]); const collateralDecimals = Number(collateralConfig[0]);
  if (debtDecimals !== position.debtAssetDecimals || collateralDecimals !== position.collateralAssetDecimals) throw new Error('Token decimal verification failed.');
  const variableBorrowApr = Number(debtData[6] as bigint) / 1e27; const baseUnit = Number(baseUnitRaw);
  const debtPriceUsd = Number(debtPriceRaw) / baseUnit; const collateralPriceUsd = Number(collateralPriceRaw) / baseUnit; const nativePriceUsd = Number(nativePriceRaw) / baseUnit;
  if (![variableBorrowApr, debtPriceUsd, collateralPriceUsd, nativePriceUsd].every(Number.isFinite) || nativePriceUsd <= 0) throw new Error('Aave rate or oracle price is invalid.');
  const availableLiquidityAssets = (debtData[2] as bigint) - (debtData[4] as bigint);
  const borrowCapAssets = capUnits(debtCaps[0] as bigint, debtDecimals); const supplyCapAssets = capUnits(collateralCaps[1] as bigint, collateralDecimals);
  return {
    proof: { source: 'Aave V3 Ethereum on-chain contracts (address provider, protocol data provider, oracle)', timestamp: new Date(selected.timestamp * 1000).toISOString(), blockNumber: selected.number, blockHash: selected.block.hash, endpoint: readEndpoints.join(' | ') },
    witnessHeads: valid.map((head) => head.number), debtPriceUsd, collateralPriceUsd, nativePriceUsd, debtDecimals, collateralDecimals,
    variableBorrowApr: variableBorrowApr * 100, variableBorrowApy: Math.expm1(variableBorrowApr) * 100,
    ltv: Number(collateralConfig[1]) / 100, liquidationThreshold: Number(collateralConfig[2]) / 100,
    availableLiquidityAssets, borrowCapHeadroomAssets: borrowCapAssets === null ? null : borrowCapAssets - (debtData[4] as bigint), supplyCapHeadroomAssets: supplyCapAssets === null ? null : supplyCapAssets - (collateralData[2] as bigint),
    collateralEnabled: Boolean(collateralConfig[5]), borrowingEnabled: Boolean(debtConfig[6]), debtReserveActive: Boolean(debtConfig[8]), debtReserveFrozen: Boolean(debtConfig[9]), collateralReserveActive: Boolean(collateralConfig[8]), collateralReserveFrozen: Boolean(collateralConfig[9]),
    collateralDebtCeiling: debtCeiling, siloedBorrowing, morphoFlashLiquidityAssets: morphoFlashLiquidity, aaveFlashPremiumBps: Number(flashPremiumRaw), gasPriceWei: BigInt(gasPriceHex),
    existingCollateralUsd: Number(accountData[0]) / baseUnit, existingDebtUsd: Number(accountData[1]) / baseUnit,
    existingLiquidationThreshold: Number(accountData[3]) / 100,
    existingHealthFactor: Number(accountData[1]) > 0 ? Number(accountData[5]) / 1e18 : null,
    userEMode: Number(userEModeRaw),
  };
}
