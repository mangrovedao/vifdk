import { useCallback } from 'react'
import type { ReadContractReturnType } from 'viem'
import { Market, openMarkets } from 'vifdk'
import type { PrepareReadResult } from '../types'
import { useVif } from '../vif'

type ReaderContracts = ReturnType<typeof openMarkets>

export function useReaderOpenMarketsParams(
	from?: number,
	maxLength?: number,
): PrepareReadResult<
	Market[],
	ReaderContracts['abi'],
	ReaderContracts['functionName']
> {
	const vif = useVif()

	const select = useCallback(
		(
			data: ReadContractReturnType<
				ReaderContracts['abi'],
				ReaderContracts['functionName']
			>,
		) => {
			const tokens = vif?.tokens ?? []
			return data
				.map((market) => Market.fromOpenMarketResult(market, tokens))
				.filter((market) => market !== undefined)
		},
		[vif?.tokens],
	)

	return {
		address: vif?.reader,
		select,
		initialData: [],
		...openMarkets(from, maxLength),
	}
}
