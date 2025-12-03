import { useChainId } from 'wagmi'
import type { VifChainConfig } from '../config'
import { useVifConfig } from './config'

export function useVif(): VifChainConfig | undefined {
	const chainId = useChainId()
	const config = useVifConfig()
	return config[chainId]
}
