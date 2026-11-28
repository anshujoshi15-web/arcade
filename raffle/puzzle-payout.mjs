import {readFileSync} from 'node:fs';
import {Contract, JsonRpcProvider, Interface, ZeroHash, formatEther, getAddress, parseUnits} from 'ethers';

const [address, placeText, hash, usdPerEth] = process.argv.slice(2);
if (!address || !/^(?:[1-9]|10)$/.test(placeText || '') ||
    !/^0x[0-9a-f]{64}$/i.test(hash || '') || !/^\d+(?:\.\d{1,6})?$/.test(usdPerEth || '')) {
  throw new Error('Usage: node raffle/puzzle-payout.mjs CONTRACT PLACE BASE_TX_HASH USD_PER_ETH');
}
const rate = parseUnits(usdPerEth, 6);
if (rate <= 0n) throw new Error('The conversion rate must be positive.');
const abi = JSON.parse(readFileSync(new URL('./PuzzlePrint.json', import.meta.url))).abi;
const provider = new JsonRpcProvider(process.env.PUZZLE_RPC || 'https://mainnet.base.org');
try {
  if ((await provider.getNetwork()).chainId !== 8453n) throw new Error('Use a Base mainnet RPC.');
  const contract = new Contract(getAddress(address), abi, provider);
  const place = Number(placeText);
  if (BigInt(place) > await contract.places()) throw new Error('This place has not been claimed.');
  const [winner, config, tx, receipt, used] = await Promise.all([
    contract.winners(place - 1), contract.setup(), provider.getTransaction(hash),
    provider.getTransactionReceipt(hash), contract.usedReceipt(hash)
  ]);
  const expected = winner.usdcValue * 10n ** 18n / rate;
  if (used || winner.payout !== ZeroHash) throw new Error('A receipt is already recorded for this place or transaction.');
  if (!tx || receipt?.status !== 1 || await receipt.confirmations() < 10 ||
      tx.from.toLowerCase() !== config.house.toLowerCase() ||
      tx.to?.toLowerCase() !== winner.wallet.toLowerCase() || tx.value !== expected || tx.data !== '0x') {
    throw new Error('No sufficiently confirmed direct House payment matches the winner and ETH amount.');
  }
  console.log(JSON.stringify({
    contract:contract.target, place, winner:winner.wallet, usdPerEth, eth:formatEther(expected), hash,
    unsignedRecordPayout:new Interface(abi).encodeFunctionData('recordPayout', [place, hash])
  }, null, 2));
} finally { provider.destroy(); }
