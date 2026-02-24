export const computeSpendableWei = (params: {
  balanceWei: bigint;
  deployFeeWei: bigint;
  transferFeeWei: bigint;
  safetyBufferWei: bigint;
}): bigint => {
  return params.balanceWei - params.deployFeeWei - params.transferFeeWei - params.safetyBufferWei;
};

export const pickTransferAmountWei = (requestedWei: bigint, spendableWei: bigint): bigint => {
  return requestedWei < spendableWei ? requestedWei : spendableWei;
};

export const hasPositiveReceiverDelta = (
  receiverBalanceBeforeWei: bigint,
  receiverBalanceAfterWei: bigint
): boolean => {
  return receiverBalanceAfterWei > receiverBalanceBeforeWei;
};

