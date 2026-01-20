/**
 * The maximum tick
 */
export const MAX_TICK = 8_388_607n

/**
 * The minimum tick
 */
export const MIN_TICK = -8_388_607n

/** The number of bits for the offer amount */
export const OFFER_AMOUNT_BITS = 48
/** The number of bits for the units */
export const UNITS_BITS = 64
/** The number of bits for the fees */
export const FEES_BITS = 16

/** The number of bits for the min outbound units */
export const MIN_OUTBOUND_UNITS_MAX: bigint = 2n ** 32n - 1n
/** The minimum outbound units */
export const MIN_OUTBOUND_UNITS_MIN = 1n

/** The maximum tick spacing */
export const MAX_TICK_SPACING: bigint = 2n ** 16n - 1n
/** The minimum tick spacing */
export const MIN_TICK_SPACING = 1n
