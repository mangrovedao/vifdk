import { useCallback, useMemo } from 'react'
import type { Address, MulticallResults } from 'viem'
import { type Market, OfferList } from 'vifdk'
import { packedOfferList } from 'vifdk/builder/reader'
import type { PrepareReadsResult } from '../types'
import { useVif } from '../vif'

type PackedOfferListContracts = ReturnType<typeof packedOfferList> & {
	address?: Address
}
type Contracts = readonly [PackedOfferListContracts, PackedOfferListContracts]
type ContractResult = MulticallResults<Contracts>

export function useReaderOfferListParams(
	market?: Market,
): PrepareReadsResult<Contracts, { asks: OfferList; bids: OfferList }> {
	const vif = useVif()
	const contracts = useMemo(() => {
		if (!market) return undefined
		return [
			{
				address: vif?.reader,
				...packedOfferList(market.asks.key),
			},
			{
				address: vif?.reader,
				...packedOfferList(market.bids.key),
			},
		] satisfies Contracts
	}, [market, vif?.reader])

	const select = useCallback(
		(data: ContractResult) => {
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
		[market],
	)

	return {
		contracts,
		select,
		initialData: [
			{ status: 'success', result: [0, [], [], []] },
			{ status: 'success', result: [0, [], [], []] },
		] satisfies ContractResult,
	}
}
