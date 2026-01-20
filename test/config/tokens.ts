import {
	type Address,
	type Client,
	encodeDeployData,
	maxUint128,
	maxUint256,
	parseAbi,
} from 'viem'
import { multicall, writeContractSync } from 'viem/actions'
import { Token, type TokenAmount } from '../../src'
import { bytesCodes } from '../static/bytescodes'
import { ERC20Abi } from '../static/ERC20Abi'
import { mint } from './mint'
import { deploy } from './utils'

export async function deployToken(
	client: Client,
	name: string,
	symbol: string,
	decimals: number,
	units: bigint,
): Promise<Token> {
	const bytecode = bytesCodes()
	const params = encodeDeployData({
		abi: ERC20Abi,
		args: [name, symbol, decimals],
		bytecode: bytecode.ERC20,
	})
	const token = await deploy(client, params, 'Token')
	return Token.from(token, decimals, symbol, units)
}

export async function deployWETH(
	client: Client,
	units: bigint,
): Promise<Token> {
	const bytecode = bytesCodes()
	const params = encodeDeployData({
		abi: parseAbi(['constructor()']),
		bytecode: bytecode.WETH,
	})
	const token = await deploy(client, params, 'WETH')
	return Token.from(token, 18, 'WETH', units)
}

export async function approveIfNeeded(
	client: Client,
	tokens: Token[],
	spender: Address,
): Promise<void> {
	const tokensSet = new Set<Address>()
	for (const token of tokens) {
		tokensSet.add(token.address)
	}
	const addresses = Array.from(tokensSet)
	const approvals = await multicall(client, {
		contracts: addresses.map(
			(address) =>
				({
					address,
					abi: ERC20Abi,
					functionName: 'allowance',
					// biome-ignore lint/style/noNonNullAssertion: test env
					args: [client.account!.address, spender],
				}) as const,
		),
		allowFailure: false,
	})

	for (const [i, approval] of approvals.entries()) {
		if (approval < maxUint128) {
			await writeContractSync(client, {
				// biome-ignore lint/style/noNonNullAssertion: test env
				address: addresses[i]!,
				abi: ERC20Abi,
				functionName: 'approve',
				args: [spender, maxUint256],
				chain: client.chain,
				// biome-ignore lint/style/noNonNullAssertion: test env
				account: client.account!,
			})
		}
	}
}

export async function mintTokens(
	client: Client,
	wethAddress: Address,
	tokens: TokenAmount[],
): Promise<void> {
	const map = new Map<Address, TokenAmount>()
	for (const token of tokens) {
		const amount = map.get(token.token.address) ?? token.token.amount(0n)
		amount.amount += token.amount
		map.set(token.token.address, amount)
	}
	for (const amount of map.values()) {
		await mint(client, amount, wethAddress)
	}
}
