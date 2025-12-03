import {
	type Address,
	type Client,
	encodeDeployData,
	maxUint128,
	maxUint256,
	parseAbi,
} from 'viem'
import { multicall, writeContractSync } from 'viem/actions'
import { Market } from '../../src/lib/market'
import { Token, type TokenAmount } from '../../src/lib/token'
import { bytesCodes } from '../static/bytescodes'
import { ERC20Abi } from '../static/ERC20Abi'
import { mint } from './mint'
import { deploy } from './utils'

type Config = {
	WETH: Token
	USDC: Token
	Vif: Address
	market: Market
	VifReader: Address
	VifRouter: Address
	multicall: Address
	provision: TokenAmount
}

const DEFAULT_WETH = Token.from(
	'0x0000000000000000000000000000000000000001',
	18,
	'WETH',
	10n ** 14n,
)
const DEFAULT_USDC = Token.from(
	'0x0000000000000000000000000000000000000002',
	6,
	'USDC',
	100n,
)

export async function deployToken(
	client: Client,
	name: string,
	symbol: string,
	decimals: number,
	units: bigint,
): Promise<Token> {
	const bytecode = await bytesCodes()
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
	const bytecode = await bytesCodes()
	const params = encodeDeployData({
		abi: parseAbi(['constructor()']),
		bytecode: bytecode.WETH,
	})
	const token = await deploy(client, params, 'WETH')
	return Token.from(token, 18, 'WETH', units)
}

export const config: Config = {
	WETH: DEFAULT_WETH,
	USDC: DEFAULT_USDC,
	market: Market.create({
		base: DEFAULT_WETH.amount('1'),
		quote: DEFAULT_USDC.amount('100'),
		tickSpacing: 1n,
	}),
	Vif: '0x0000000000000000000000000000000000000003',
	VifReader: '0x0000000000000000000000000000000000000004',
	VifRouter: '0x0000000000000000000000000000000000000005',
	multicall: '0x0000000000000000000000000000000000000006',
	provision: Token.PROVISION_TOKEN.amount('0.00001'),
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
	tokens: TokenAmount[],
): Promise<void> {
	const map = new Map<Address, TokenAmount>()
	for (const token of tokens) {
		const amount = map.get(token.token.address) ?? token.token.amount(0n)
		amount.amount += token.amount
		map.set(token.token.address, amount)
	}
	for (const amount of map.values()) {
		await mint(client, amount)
	}
}
