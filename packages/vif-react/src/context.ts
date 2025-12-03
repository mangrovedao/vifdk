import type React from 'react'
import { createContext, createElement } from 'react'
import type { VifChainConfig } from './config'

export const VifContext: React.Context<Record<number, VifChainConfig>> =
	createContext<Record<number, VifChainConfig>>({})

export function VifProvider(
	parameters: React.PropsWithChildren<{
		config: Record<number, VifChainConfig>
	}>,
): React.ReactElement<React.ProviderProps<Record<number, VifChainConfig>>> {
	const { config, children } = parameters
	return createElement(VifContext.Provider, { value: config }, children)
}
