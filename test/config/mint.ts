import {
	type Address,
	type Client,
	isAddressEqual,
	parseAbi,
	type TestClient,
} from 'viem'
import {
	getBalance,
	setBalance,
	waitForTransactionReceipt,
	writeContract,
} from 'viem/actions'
import type { TokenAmount } from '../../src/lib/token'
import { ERC20Abi } from '../static/ERC20Abi'
import { config } from './tokens'

export async function mint(
	client: Client,
	amount: TokenAmount,
	to?: Address,
): Promise<void> {
	// biome-ignore lint/style/noNonNullAssertion: test env
	if (!to) to = client.account!.address
	if (isAddressEqual(amount.token.address, config.WETH.address)) {
		const balance = await getBalance(client, {
			// biome-ignore lint/style/noNonNullAssertion: test env
			address: client.account!.address,
		})
		// biome-ignore lint/suspicious/noTsIgnore: force anvil mode
		// @ts-ignore
		client.mode = 'anvil'
		await setBalance(client as TestClient, {
			// biome-ignore lint/style/noNonNullAssertion: test env
			address: client.account!.address,
			value: balance + amount.amount,
		})
		const hashDeposit = await writeContract(client, {
			address: config.WETH.address,
			abi: parseAbi(['function deposit() payable']),
			functionName: 'deposit',
			args: [],
			value: amount.amount,
			chain: client.chain,
			// biome-ignore lint/style/noNonNullAssertion: test env
			account: client.account!,
		})
		await waitForTransactionReceipt(client, { hash: hashDeposit })
		// biome-ignore lint/style/noNonNullAssertion: test env
		if (!isAddressEqual(client.account!.address, to)) {
			const hashTransfer = await writeContract(client, {
				address: config.WETH.address,
				abi: ERC20Abi,
				functionName: 'transfer',
				args: [to, amount.amount],
				chain: client.chain,
				// biome-ignore lint/style/noNonNullAssertion: test env
				account: client.account!,
			})
			await waitForTransactionReceipt(client, { hash: hashTransfer })
		}
	} else {
		const hash = await writeContract(client, {
			address: amount.token.address,
			abi: ERC20Abi,
			functionName: 'mint',
			args: [to, amount.amount],
			chain: client.chain,
			// biome-ignore lint/style/noNonNullAssertion: test env
			account: client.account!,
		})
		await waitForTransactionReceipt(client, { hash })
	}
}
