import type { Address } from 'viem'
import { Token } from 'vifdk'

export type TokenParams = {
	address: Address
	decimals: number
	symbol: string
}

export type VifChainConfigParameters = {
	tokens: (TokenParams | Token)[]
	vif: Address
	router: Address
	reader: Address
	chainCashness?: Record<string, number>
}

export type VifConfigParameters = {
	chains: Record<number, VifChainConfigParameters>
	cashness?: Record<string, number>
}

export type VifChainConfig = {
	tokens: Token[]
	router: Address
	vif: Address
	reader: Address
	cashness: Record<string, number>
}

export function createVifConfig(
	params: VifConfigParameters,
): Record<number, VifChainConfig> {
	return Object.entries(params.chains).reduce(
		(acc, [chain, value]) => {
			const cashness = { ...params.cashness, ...value.chainCashness }
			acc[chain] = {
				...value,
				tokens: value.tokens
					.map((token) =>
						token instanceof Token
							? token
							: Token.from(token.address, token.decimals, token.symbol),
					)
					.sort(
						(a, b) => (cashness[b.symbol] ?? 0) - (cashness[a.symbol] ?? 0),
					),
				cashness,
			} satisfies VifChainConfig
			return acc
		},
		{} as Record<number, VifChainConfig>,
	)
}
