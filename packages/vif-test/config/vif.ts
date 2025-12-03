import {
	type Address,
	type Client,
	encodeDeployData,
	isAddressEqual,
} from 'viem'
import { multicall, readContract, writeContractSync } from 'viem/actions'
import {
	type Action,
	type LimitOrderResult,
	Market,
	Offer,
	type OrderResult,
	type SemiMarket,
	type Tick,
	Token,
	type TokenAmount,
	VifRouter,
	type VifRouterActions,
} from '../../core/src'
import { rawOffer } from '../../core/src/builder/core'
import { bytesCodes } from '../static/bytescodes'
import { VifAbi } from '../static/VifAbi'
import { VifReaderAbi } from '../static/VifReaderABI'
import { VifRouterAbi } from '../static/VifRouterABI'
import { mint } from './mint'
import { approveIfNeeded, config, mintTokens } from './tokens'
import { deploy } from './utils'

export async function deployVif(
	client: Client,
	admin: Address,
	provision: number,
): Promise<Address> {
	const bytecode = await bytesCodes()
	const params = encodeDeployData({
		abi: VifAbi,
		bytecode: bytecode.Vif,
		args: [admin, provision],
	})
	return deploy(client, params, 'VIF')
}

export async function deployVifReader(
	client: Client,
	vif: Address,
): Promise<Address> {
	const bytecode = await bytesCodes()
	const params = encodeDeployData({
		abi: VifReaderAbi,
		bytecode: bytecode.VifReader,
		args: [vif],
	})
	return deploy(client, params, 'VIFReader')
}

export async function deployVifRouter(
	client: Client,
	vif: Address,
	weth: Address,
	admin: Address,
): Promise<Address> {
	const bytecode = await bytesCodes()
	const params = encodeDeployData({
		abi: VifRouterAbi,
		bytecode: bytecode.VifRouter,
		args: [vif, weth, admin],
	})
	return deploy(client, params, 'VIFRouter')
}

export async function authorize(
	client: Client,
	vif: Address,
	target: Address,
): Promise<void> {
	await writeContractSync(client, {
		address: vif,
		abi: VifAbi,
		functionName: 'authorize',
		args: [target, true],
		chain: client.chain,
		// biome-ignore lint/style/noNonNullAssertion: test env
		account: client.account!,
	})
}

export async function openMarket(
	client: Client,
	base: TokenAmount,
	quote: TokenAmount,
	tickSpacing: bigint,
	fees: number,
): Promise<Market> {
	await writeContractSync(client, {
		address: config.Vif,
		abi: VifAbi,
		functionName: 'openMarket',
		args: [
			base.token.address,
			quote.token.address,
			base.token.unit,
			quote.token.unit,
			Number(tickSpacing),
			fees,
			Number(base.amount / base.token.unit),
		],
		chain: client.chain,
		// biome-ignore lint/style/noNonNullAssertion: test env
		account: client.account!,
	})
	await writeContractSync(client, {
		address: config.Vif,
		abi: VifAbi,
		functionName: 'openMarket',
		args: [
			quote.token.address,
			base.token.address,
			quote.token.unit,
			base.token.unit,
			Number(tickSpacing),
			fees,
			Number(quote.amount / quote.token.unit),
		],
		chain: client.chain,
		// biome-ignore lint/style/noNonNullAssertion: test env
		account: client.account!,
	})
	await writeContractSync(client, {
		address: config.VifReader,
		abi: VifReaderAbi,
		functionName: 'updateMarkets',
		args: [
			base.token.address,
			quote.token.address,
			base.token.unit,
			quote.token.unit,
			Number(tickSpacing),
		],
		chain: client.chain,
		// biome-ignore lint/style/noNonNullAssertion: test env
		account: client.account!,
	})
	return Market.create({
		base,
		quote,
		tickSpacing,
		askFees: fees,
		bidsFees: fees,
	})
}

export async function createOffer(
	client: Client,
	market: SemiMarket,
	gives: TokenAmount,
	tick: Tick,
	expiry?: Date,
	provision?: TokenAmount,
): Promise<Offer> {
	// biome-ignore lint/style/noNonNullAssertion: test env
	const router = new VifRouter(config.VifRouter, config.Vif, client.chain!.id)
	const actions = router
		.createTypedActions()
		.limitSingle({
			market,
			gives,
			tick,
			expiry,
			provision,
		})
		.settleAll(gives.token)
		.settleAll(Token.NATIVE_TOKEN)
		.build()

	await mint(client, gives)

	const data = actions.txData()

	await approveIfNeeded(client, [gives.token], config.Vif)

	const receipt = await writeContractSync(client, {
		address: config.VifRouter,
		abi: VifRouterAbi,
		functionName: 'execute',
		args: [data.commands, data.args],
		value: expiry ? (provision?.amount ?? config.provision.amount) : 0n,
		chain: client.chain,
		// biome-ignore lint/style/noNonNullAssertion: test env
		account: client.account!,
	})
	const [lo] = actions.parseLogs(receipt.logs)

	if (!lo) throw new Error('Limit order not found')

	return readContract(client, {
		address: config.Vif,
		// biome-ignore lint/style/noNonNullAssertion: test env
		...rawOffer(market, lo.data!.offerId),
	}).then((val) =>
		Offer.fromPacked(
			market,
			val,
			// biome-ignore lint/style/noNonNullAssertion: test env
			lo.data!.offerId,
			client.account?.address,
		),
	)
}

type SingleOffer = {
	market: SemiMarket
	gives: TokenAmount
	tick: Tick
	expiry?: Date
	provision?: TokenAmount
}

export async function createOffers(
	client: Client,
	offers: SingleOffer[],
): Promise<Offer[]> {
	await mintTokens(
		client,
		offers.map((o) => o.gives),
	)
	await approveIfNeeded(
		client,
		offers.map((o) => o.gives.token),
		config.Vif,
	)

	// biome-ignore lint/style/noNonNullAssertion: test env
	const router = new VifRouter(config.VifRouter, config.Vif, client.chain!.id)

	const builder = router.createActions()

	const totalProvision = Token.PROVISION_TOKEN.amount(0n)

	const tokens = new Map<Address, Token>()

	for (const offer of offers) {
		builder.limitSingle({
			market: offer.market,
			gives: offer.gives,
			tick: offer.tick,
			expiry: offer.expiry,
			provision: offer.provision,
		})

		tokens.set(offer.gives.token.address, offer.gives.token)
		totalProvision.amount += offer.provision?.amount ?? config.provision.amount
	}

	for (const token of tokens.values()) {
		builder.settleAll(token)
	}

	const actions = builder
		.settleAll(Token.NATIVE_TOKEN)
		.build() as VifRouterActions<Action[]>

	const { commands, args } = actions.txData()

	const receipt = await writeContractSync(client, {
		address: config.VifRouter,
		abi: VifRouterAbi,
		functionName: 'execute',
		args: [commands, args],
		chain: client.chain,
		// biome-ignore lint/style/noNonNullAssertion: test env
		account: client.account!,
		value: totalProvision.amount,
	})
	const results = actions.parseLogs(receipt.logs)
	return multicall(client, {
		contracts: offers.map(
			(offer, i) =>
				({
					address: config.Vif,
					...rawOffer(
						offer.market,
						// biome-ignore lint/style/noNonNullAssertion: test env
						(results[i].data as LimitOrderResult | undefined)!.offerId,
					),
				}) as const,
		),
		allowFailure: false,
	}).then((multicallRes) =>
		multicallRes.map((r, i) =>
			Offer.fromPacked(
				// biome-ignore lint/style/noNonNullAssertion: test env
				offers[i]!.market,
				r,
				// biome-ignore lint/style/noNonNullAssertion: test env
				(results[i].data as LimitOrderResult | undefined)!.offerId,
				// biome-ignore lint/style/noNonNullAssertion: test env
				client.account!.address,
			),
		),
	)
}

export async function marketOrder(
	client: Client,
	market: SemiMarket,
	amount: TokenAmount,
): Promise<OrderResult> {
	if (
		!isAddressEqual(amount.token.address, market.inboundToken.token.address)
	) {
		throw new Error('Amount token does not match market inbound token')
	}
	await mint(client, amount)
	await approveIfNeeded(client, [amount.token], config.Vif)
	// biome-ignore lint/style/noNonNullAssertion: test env
	const router = new VifRouter(config.VifRouter, config.Vif, client.chain!.id)
	const actions = router
		.createTypedActions()
		.orderSingle({
			market,
			fillVolume: amount,
		})
		.settleAll(amount.token)
		.takeAll({
			// biome-ignore lint/style/noNonNullAssertion: test env
			receiver: client.account!.address,
			token: market.outboundToken.token,
		})
		.takeAll({
			// biome-ignore lint/style/noNonNullAssertion: test env
			receiver: client.account!.address,
			token: Token.NATIVE_TOKEN,
		})
		.build()
	const { commands, args } = actions.txData()
	const receipt = await writeContractSync(client, {
		address: config.VifRouter,
		abi: VifRouterAbi,
		functionName: 'execute',
		args: [commands, args],
		chain: client.chain,
		// biome-ignore lint/style/noNonNullAssertion: test env
		account: client.account!,
	})
	const results = actions.parseLogs(receipt.logs)
	// biome-ignore lint/style/noNonNullAssertion: result is defined
	return results[0]!.data!
}
