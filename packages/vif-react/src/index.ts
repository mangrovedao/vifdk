export type { VifChainConfig, VifConfigParameters } from './config'
export { createVifConfig } from './config'

export { VifProvider } from './context'
export type {
	useReaderOfferListParams,
	useReaderOpenMarketsParams,
} from './hooks/export'
export { useVif, useVifConfig } from './hooks/export'
