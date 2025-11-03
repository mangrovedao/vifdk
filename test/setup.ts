import { afterAll, beforeAll, beforeEach } from 'bun:test'
import { anvil, type Instance } from 'prool/instances'
import { config, deployToken, deployWETH } from './config/tokens'
import { deployMulticall } from './config/utils'
import {
	deployVif,
	deployVifReader,
	deployVifRouter,
	openMarket,
} from './config/vif'
import {
	BASE_IPC,
	BASE_PORT,
	baseClient,
	IPC,
	MNEMONIC,
	mainClient,
	PORT,
} from './utils'

let baseInstance: Instance | undefined
let proolInstance: Instance | undefined
let initBlock = 0n

beforeAll(async () => {
	if (baseInstance) await baseInstance.stop()
	if (proolInstance) await proolInstance.stop()
	baseInstance = anvil({
		mnemonic: MNEMONIC,
		port: BASE_PORT,
		ipc: BASE_IPC,
	})
	await baseInstance.start()

	const client = baseClient()

	// deploy WETH
	config.WETH = await deployWETH(client, 10n ** 14n)

	// deploy USDC
	config.USDC = await deployToken(client, 'USDC', 'USDC', 6, 100n)

	// deploy VIF
	config.Vif = await deployVif(
		client,
		client.account.address,
		Number(config.provision.amount / config.provision.token.unit),
	)

	// deploy VIFReader
	config.VifReader = await deployVifReader(client, config.Vif)

	// deploy VIFRouter
	config.VifRouter = await deployVifRouter(
		client,
		config.Vif,
		config.WETH.address,
		client.account.address,
	)

	// deploy multicall
	config.multicall = await deployMulticall(client)

	// open market
	config.market = await openMarket(
		client,
		config.WETH.amount('0.001'),
		config.USDC.amount('5'),
		1n,
		100,
	)

	initBlock = await client.getBlockNumber()

	proolInstance = anvil({
		mnemonic: MNEMONIC,
		port: PORT,
		ipc: IPC,
		forkUrl: BASE_IPC,
		forkBlockNumber: initBlock,
	})
	await proolInstance.start()
})

beforeEach(async () => {
	// if (!proolInstance) throw new Error("Prool instance not started");
	// await proolInstance.restart();
	const client = mainClient()
	await client.reset()
})

afterAll(async () => {
	if (baseInstance) await baseInstance.stop()
	if (proolInstance) await proolInstance.stop()
})
