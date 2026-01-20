/**
 * Thrown when an amount or unit is out of range
 */
export class BitsOverflowError extends RangeError {
	constructor(maxBits: number, amount: bigint, label: string = 'amount') {
		const nBits = amount.toString(2).length
		super(
			`${label} should fit within ${maxBits} bits, got ${nBits} bits (${label}: ${amount})`,
		)
	}
}

/**
 * Checks if an amount fits within a number of bits
 * @param amount - The amount to check
 * @param maxBits - The number of bits to check
 * @returns True if the amount fits within the number of bits, false otherwise
 */
export function checkFitsWithin(amount: bigint, maxBits: number): boolean {
	if (amount < 0n) {
		return false
	}
	return BigInt.asUintN(maxBits, amount) === amount
}

/**
 * Multiplies two numbers and divides the result by a denominator, rounding up
 * @param a - The first number to multiply
 * @param b - The second number to multiply
 * @param denominator - The denominator to divide the result by
 * @returns The result of the multiplication and division
 */
export function mulDivUp(a: bigint, b: bigint, denominator: bigint): bigint {
	return divUp(a * b, denominator)
}

/**
 * Divides a number by a denominator and rounds up
 * @param a - The number to divide
 * @param b - The denominator to divide by
 * @returns The result of the division rounded up
 */
export function divUp(a: bigint, b: bigint): bigint {
	return (a + b - 1n) / b
}
