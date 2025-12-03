import type { MulticallErrorType, ReadContractErrorType } from 'viem'
import { Market } from 'vifdk'
import { openMarkets } from 'vifdk/builder/reader'
import { type UseReadContractParameters, useReadContract } from 'wagmi'
import type { QueryParameter } from 'wagmi/internal'
import type { UseQueryReturnType } from 'wagmi/query'
import { useVif } from '../vif'

export type ReaderOpenMarketsParams = Omit<
	UseReadContractParameters,
	'address' | 'abi' | 'functionName' | 'args'
>

export function useReaderOpenMarkets(
	params: ReaderOpenMarketsParams = {},
): UseQueryReturnType<
	Market[] | undefined,
	MulticallErrorType | ReadContractErrorType
> {
	const vif = useVif()
	const { query, ...restParams } = params
	return useReadContract({
		...restParams,
		address: vif?.reader,
		...openMarkets(),
		query: {
			...(query as unknown as QueryParameter),
			select(data) {
				const tokens = vif?.tokens ?? []
				return data
					.map((market) => Market.fromOpenMarketResult(market, tokens))
					.filter((market) => market !== undefined)
			},
		},
	})
}
