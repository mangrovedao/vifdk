import {
	type Address,
	type Client,
	type Hex,
	hexToString,
	type MulticallParameters,
	type ReadContractParameters,
} from 'viem'
import { multicall, readContract } from 'viem/actions'
import {
	type OPEN_MARKETS_ABI,
	openMarkets,
	tokenMetadataWithFallback,
} from '../builder/reader/open-markets'
import { Market } from '../lib/market'
import { Token } from '../lib/token'

/**
 * Metadata for an ERC20 token
 */
export type TokenMetadata = {
	/** Contract address of the token */
	address: Address
	/** Number of decimal places used by the token */
	decimals: number
	/** Token symbol (e.g. "USDC") */
	symbol: string
}

/**
 * Actions for interacting with open markets
 */
export type OpenMarketsActions = {
	/**
	 * Fetches metadata for multiple tokens in a single multicall
	 * @param tokens - Array of token addresses to fetch metadata for
	 * @param args - Additional multicall parameters
	 * @returns Array of token metadata objects
	 */
	tokensMetadata: (
		tokens: Address[],
		args: Omit<MulticallParameters, 'contracts' | 'allowFailure'>,
	) => Promise<TokenMetadata[]>

	/**
	 * Fetches open markets with a custom metadata resolver
	 * @param cashness - Record mapping token symbols to their "cashness" scores
	 * @param metadataResolver - Custom function to resolve token metadata
	 * @param resolverArgs - Arguments to pass to the metadata resolver
	 * @param from - Starting index for pagination (optional)
	 * @param to - Maximum number of markets to return (optional)
	 * @param args - Additional contract read parameters (optional)
	 * @returns Array of Market objects
	 */
	openMarketsWithResolver: <TResolverArgs = unknown>(
		cashness: Record<string, number>,
		metadataResolver: (
			token: Address[],
			args: TResolverArgs,
		) => Promise<TokenMetadata[]>,
		resolverArgs: TResolverArgs,
		from?: number | undefined,
		to?: number | undefined,
		args?:
			| Omit<ReadContractParameters, 'address' | 'abi' | 'functionName'>
			| undefined,
	) => Promise<Market[]>

	/**
	 * Fetches open markets with default token metadata resolution
	 * @param cashness - Record mapping token symbols to their "cashness" scores
	 * @param from - Starting index for pagination (optional)
	 * @param to - Maximum number of markets to return (optional)
	 * @param tokensMulticallArgs - Additional multicall parameters for token metadata (optional)
	 * @param args - Additional contract read parameters (optional)
	 * @returns Array of Market objects
	 */
	openMarketsFull: (
		cashness: Record<string, number>,
		from?: number | undefined,
		to?: number | undefined,
		tokensMulticallArgs?:
			| Omit<MulticallParameters, 'contracts' | 'allowFailure'>
			| undefined,
		args?:
			| Omit<ReadContractParameters, 'address' | 'abi' | 'functionName'>
			| undefined,
	) => Promise<Market[]>
}

/**
 * Creates actions for interacting with open markets
 * @param vifReader - Address of the VifReader contract
 * @returns Actions for interacting with open markets
 * @example
 * const client = createClient(...)
 *   .extend(openMarketsActions("0x123..."))
 *
 * const markets = await client.openMarketsFull({
 *   WETH: 100,
 *   USDC: 1000,
 * })
 */
export function openMarketsActions(vifReader: Address) {
	return (client: Client): OpenMarketsActions => ({
		async tokensMetadata(tokens, args) {
			const res = await multicall(client, {
				...args,
				contracts: tokens.flatMap(tokenMetadataWithFallback),
				allowFailure: true,
			})

			const result: TokenMetadata[] = []
			for (const [t, tokenAddress] of tokens.entries()) {
				const baseIndex = t * 3
				const decimals = res[baseIndex]
				const symbol = res[baseIndex + 1]
				const symbolBytes32 = res[baseIndex + 2]

				if (!decimals || !symbol || !symbolBytes32) {
					throw new Error('Unexpected result from multicall')
				}

				if (decimals.status === 'failure') throw decimals.error
				if (symbol.status === 'failure' && symbolBytes32.status === 'failure') {
					throw symbol.error
				}

				const resolvedSymbol =
					symbol.status === 'failure'
						? hexToString(symbolBytes32.result as Hex, { size: 32 })
						: (symbol.result as string)

				result.push({
					address: tokenAddress,
					decimals: decimals.result as number,
					symbol: resolvedSymbol,
				})
			}
			return result
		},

		async openMarketsWithResolver(
			cashness,
			metadataResolver,
			resolverArgs,
			from,
			to,
			args,
		) {
			const markets = await readContract(client, {
				...args,
				address: vifReader,
				...openMarkets(from, to),
			} as ReadContractParameters<typeof OPEN_MARKETS_ABI, 'openMarkets'>)
			const tokensSet = new Set<Address>()
			for (const market of markets) {
				tokensSet.add(market.market01.outboundToken)
				tokensSet.add(market.market01.inboundToken)
			}
			const tokens = await metadataResolver(Array.from(tokensSet), resolverArgs)
			const metadataByAddress = new Map<string, TokenMetadata>()
			for (const meta of tokens) {
				metadataByAddress.set(meta.address.toLowerCase(), meta)
			}

			return markets.map((market) => {
				const token0Metadata = metadataByAddress.get(
					market.market01.outboundToken.toLowerCase(),
				)
				const token1Metadata = metadataByAddress.get(
					market.market01.inboundToken.toLowerCase(),
				)

				if (!token0Metadata || !token1Metadata)
					throw new Error('Token not found')

				const token0 = Token.from(
					token0Metadata.address,
					token0Metadata.decimals,
					token0Metadata.symbol,
					market.market01.outboundUnits,
				).amount(BigInt(market.market01.minOutboundUnits))

				const token1 = Token.from(
					token1Metadata.address,
					token1Metadata.decimals,
					token1Metadata.symbol,
					market.market10.outboundUnits,
				).amount(BigInt(market.market10.minOutboundUnits))

				const isBase0 =
					(cashness[token0Metadata.symbol] || 0) <=
					(cashness[token1Metadata.symbol] || 0)

				const base = isBase0 ? token0 : token1
				const quote = isBase0 ? token1 : token0

				return Market.create({
					base,
					quote,
					tickSpacing: BigInt(market.market01.tickSpacing),
				})
			})
		},
		openMarketsFull(cashness, from, to, tokensMulticallArgs, args) {
			return this.openMarketsWithResolver(
				cashness,
				this.tokensMetadata,
				tokensMulticallArgs ?? {},
				from,
				to,
				args,
			)
		},
	})
}
