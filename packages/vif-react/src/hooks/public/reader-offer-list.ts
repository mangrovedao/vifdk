import type { MulticallErrorType, ReadContractErrorType } from 'viem'
import { type Market, OfferList } from 'vifdk'
import { packedOfferList } from 'vifdk/builder/reader'
import { type UseReadContractsParameters, useReadContracts } from 'wagmi'
import type { QueryParameter } from 'wagmi/internal'
import type { UseQueryReturnType } from 'wagmi/query'
import { useVif } from '../vif'

export type ReaderOfferListParams = Omit<
	UseReadContractsParameters,
	'contracts' | 'allowFailure'
> & {
	market?: Market
}

export function useReaderOfferList({
	market,
	...rest
}: ReaderOfferListParams): UseQueryReturnType<
	| {
			asks: OfferList
			bids: OfferList
	  }
	| undefined,
	MulticallErrorType | ReadContractErrorType
> {
	const vif = useVif()
	return useReadContracts({
		...rest,
		contracts: market
			? ([
					{
						address: vif?.reader,
						...packedOfferList(market.asks.key),
					},
					{
						address: vif?.reader,
						...packedOfferList(market.bids.key),
					},
				] as const)
			: undefined,
		allowFailure: true,
		query: {
			...(rest.query as unknown as QueryParameter),
			select(data) {
				if (!market) return undefined
				const asks =
					data[0].status === 'success'
						? OfferList.fromPacked(
								market.asks,
								data[0].result[1],
								data[0].result[2],
								data[0].result[3],
							)
						: OfferList.fromSemiMarket(market.asks)
				const bids =
					data[1].status === 'success'
						? OfferList.fromPacked(
								market.bids,
								data[1].result[1],
								data[1].result[2],
								data[1].result[3],
							)
						: OfferList.fromSemiMarket(market.bids)
				return { asks, bids }
			},
		},
	})
}
