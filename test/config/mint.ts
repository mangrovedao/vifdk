import {
	type Address,
	type Client,
	isAddressEqual,
	parseAbi,
	type TestClient,
} from 'viem'
import { getBalance, setBalance, writeContract } from 'viem/actions'
import type { TokenAmount } from '../../src'
import { ERC20Abi } from '../static/ERC20Abi'

export async function mint(
	client: Client,
	amount: TokenAmount,
	wethAddress: Address,
	to?: Address,
): Promise<void> {
	// biome-ignore lint/style/noNonNullAssertion: test env
	if (!to) to = client.account!.address
	if (isAddressEqual(amount.token.address, wethAddress)) {
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
		await writeContract(client, {
			address: wethAddress,
			abi: parseAbi(['function deposit() payable']),
			functionName: 'deposit',
			args: [],
			value: amount.amount,
			chain: client.chain,
			// biome-ignore lint/style/noNonNullAssertion: test env
			account: client.account!,
		})
		// biome-ignore lint/style/noNonNullAssertion: test env
		if (!isAddressEqual(client.account!.address, to)) {
			await writeContract(client, {
				address: wethAddress,
				abi: ERC20Abi,
				functionName: 'transfer',
				args: [to, amount.amount],
				chain: client.chain,
				// biome-ignore lint/style/noNonNullAssertion: test env
				account: client.account!,
			})
		}
	} else {
		await writeContract(client, {
			address: amount.token.address,
			abi: ERC20Abi,
			functionName: 'mint',
			args: [to, amount.amount],
			chain: client.chain,
			// biome-ignore lint/style/noNonNullAssertion: test env
			account: client.account!,
		})
	}
}
