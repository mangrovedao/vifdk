export type { VifChainConfig, VifConfigParameters } from './config'
export { createVifConfig } from './config'

export { VifProvider } from './context'
export type {
	ReaderOfferListParams,
	ReaderOpenMarketsParams,
} from './hooks/export'
export {
	useReaderOfferList,
	useReaderOpenMarkets,
	useVif,
	useVifConfig,
} from './hooks/export'
