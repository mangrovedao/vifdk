import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Hex } from 'viem'

type Bytecodes = {
	WETH: Hex
	ERC20: Hex
	VifRouter: Hex
	Vif: Hex
	VifReader: Hex
	multicall: Hex
}

let _bytesCodes: Bytecodes | undefined

export function bytesCodes(): Bytecodes {
	if (!_bytesCodes) {
		const filePath = resolve(__dirname, 'bytecodes.json')
		_bytesCodes = JSON.parse(readFileSync(filePath, 'utf-8'))
	}
	return _bytesCodes as Bytecodes
}
