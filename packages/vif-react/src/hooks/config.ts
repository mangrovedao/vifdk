import { useContext } from 'react'
import type { VifChainConfig } from '../config'
import { VifContext } from '../context'

export function useVifConfig(): Record<number, VifChainConfig> {
	return useContext(VifContext)
}
