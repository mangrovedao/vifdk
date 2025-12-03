import {
	type Address,
	type Client,
	encodeDeployData,
	type Hex,
	parseAbi,
} from 'viem'
import { sendTransactionSync } from 'viem/actions'
import { bytesCodes } from '../static/bytescodes'

export async function deploy(
	client: Client,
	hex: Hex,
	label: string,
): Promise<Address> {
	const receipt = await sendTransactionSync(client, {
		to: null,
		data: hex,
		// biome-ignore lint/style/noNonNullAssertion: test env
		account: client.account!,
		chain: client.chain,
	})
	const address = receipt.contractAddress
	if (!address) throw new Error(`${label} not deployed`)
	return address
}

export async function deployMulticall(client: Client): Promise<Address> {
	const bytecode = await bytesCodes()
	const params = encodeDeployData({
		abi: parseAbi(['constructor()']),
		bytecode: bytecode.multicall,
	})
	return deploy(client, params, 'Multicall')
}
