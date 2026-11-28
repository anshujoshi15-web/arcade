import { BrowserProvider, Contract, JsonRpcProvider, ZeroAddress, ZeroHash, formatUnits } from '/ethers.js';
import { setupWalletButton } from '/wallet-button.js';
import { formatUtc } from '/utc-time.js';

const el = id => document.getElementById(id);
const status = text => { el('live-status').textContent = text; };
const ids = Array.from({length:25}, (_, index) => index + 1);
const dollars = value => '$' + Number(formatUnits(value, 6)).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
const transferLink = (hash, text) => {
  const link = document.createElement('a');
  link.href = 'https://basescan.org/tx/' + hash;
  link.textContent = text;
  return link;
};

let readContract, walletContract, account, config, settings, busy = false;

function integer(id, min, max) {
  const raw = el(id).value.trim();
  if (!/^\d+$/.test(raw)) throw new Error('Enter a whole number.');
  const value = BigInt(raw);
  if (value < BigInt(min) || (max !== undefined && value > BigInt(max))) throw new Error('Number is outside the allowed range.');
  return value;
}

async function transact(action) {
  if (busy || !walletContract) return;
  const signed = walletContract;
  busy = true;
  try {
    status('Review the transaction in your wallet.');
    await action(signed);
    status('Transaction confirmed.');
    await refresh();
  } catch (error) {
    status(error.reason || error.shortMessage || error.message);
  } finally { busy = false; }
}

function action(id, work) { el(id).onclick = () => void transact(work); }
async function mine(promise) { return (await promise).wait(); }

async function refresh() {
  const wallet = account;
  const signed = walletContract;
  const [sold, left, reserved, funded, spent, places, deadline, selected, refundMode, settled, head, tail, offerCount, block] =
    await Promise.all([
      readContract.paidSold(), readContract.remaining(), readContract.reserved(), readContract.prizeFunded(),
      readContract.prizeSpent(), readContract.places(), readContract.claimDeadline(), readContract.donationRecipient(),
      readContract.refundMode(), readContract.settled(), readContract.head(), readContract.tail(), readContract.offerCount(),
      readContract.runner.getBlock('latest')
    ]);
  const now = BigInt(block.timestamp);
  const open = now >= settings.opens && now < settings.closes;
  const balance = wallet ? await readContract.balanceOfBatch(ids.map(() => wallet), ids) : ids.map(() => 0n);
  const [held, pending, claimed, voted, week, freeCount, paid] = await Promise.all(wallet ? [
    readContract.held(wallet), readContract.pending(wallet), readContract.claimed(wallet), readContract.voted(wallet),
    readContract.lastFreeWeek(wallet), readContract.freeCount(), readContract.paidBy(wallet)
  ] : []);
  if (account !== wallet || walletContract !== signed) return;
  const nextPrize = places < 10n ? await readContract.ladder(places) : 0n;
  const unique = balance.filter(value => value > 0n).length;
  el('live-count').textContent = wallet ? unique + ' of 25 unique pieces · ' + held + ' held · ' + pending + ' reserved or in trade' : 'Connect your Base wallet to see your collection.';
  el('live-tiles').replaceChildren(...ids.map((id, index) => {
    const tile = document.createElement('span');
    if (balance[index] === 0n) tile.textContent = id;
    else {
      const image = document.createElement('img');
      image.src = '/puzzle-nft/' + id + '.png';
      image.alt = 'Piece ' + id + ', ' + balance[index] + ' held';
      image.style.width = '100%';
      tile.append(image);
    }
    return tile;
  }));
  el('live-funding').textContent = sold.toLocaleString() + ' paid pieces · ' + left.toLocaleString() +
    ' left · ' + dollars(funded - spent) + ' in remaining prize allocation.';
  el('live-window').textContent = 'Entries close ' + formatUtc(settings.closes) + ' · Claims close ' + formatUtc(deadline) + '.';
  el('live-buy').disabled = !signed || !config.paidSalesEnabled || !open || left <= reserved || held + pending >= 50n;
  el('live-free').disabled = !signed || !config.paidSalesEnabled || !open || left <= reserved || held + pending >= 50n ||
    freeCount >= 6818n || week === (now - settings.opens) / 604800n + 1n;
  el('live-process').disabled = !signed || head > tail;
  el('live-collect').disabled = !signed || refundMode;
  el('live-vote').disabled = !signed || voted || !open;
  el('live-claim').disabled = !signed || claimed || unique !== 25 || sold < 18182n || places >= 10n ||
    nextPrize > funded - spent || refundMode || settled || now > deadline;
  el('live-refund').disabled = !signed || !refundMode || !paid;
  el('live-close').disabled = !signed || reserved !== 0n ||
    (sold < 18182n ? now < settings.closes || refundMode : now <= deadline || settled);
  el('live-offer').disabled = !signed || refundMode;
  el('live-accept').disabled = !signed || refundMode;
  el('live-cancel').disabled = !signed;
  const recent = Array.from({length:Number(offerCount < 15n ? offerCount : 15n)}, (_, index) => offerCount - BigInt(index));
  const offers = await Promise.all(recent.map(id => readContract.offers(id)));
  el('live-offers').replaceChildren(...offers.flatMap((offer, index) => {
    if (offer.maker === ZeroAddress) return [];
    const row = document.createElement('li');
    row.textContent = '#' + recent[index] + ' · offers piece ' + offer.offered + ' for ' + offer.wanted;
    return [row];
  }));
  const winners = await Promise.all(Array.from({length:Number(places)}, (_, index) => readContract.winners(index)));
  el('live-winners').replaceChildren(...winners.map(winner => {
    const item = document.createElement('li');
    item.style.overflowWrap = 'anywhere';
    item.textContent = winner.wallet + ' · ' + dollars(winner.usdcValue) + ' prize value · ';
    item.append(winner.payout === ZeroHash ? 'Base ETH receipt pending' : transferLink(winner.payout, 'Base ETH payout'));
    return item;
  }));
  const donation = el('live-donation');
  donation.textContent = selected === ZeroAddress ? 'Donation recipient selected at settlement.' : 'Donation recipient ' + selected + '. ';
  if (settled) {
    const settledAt = await readContract.settlementBlock();
    const [event] = await readContract.queryFilter(readContract.filters.Settled(), Number(settledAt), Number(settledAt));
    if (event) donation.append(transferLink(event.transactionHash, 'View Base settlement receipt'));
  }
}

action('live-buy', async signed => {
  const quantity = integer('live-quantity', 1, 25);
  const currency = new Contract(settings.usdc, ['function approve(address,uint256) returns(bool)', 'function allowance(address,address) view returns(uint256)'], signed.runner);
  const cost = quantity * 2_000_000n;
  if (await currency.allowance(account, config.address) < cost) await mine(currency.approve(config.address, cost));
  await requestDraw(signed, signed.buy(quantity));
});
action('live-free', signed => requestDraw(signed, signed.freePiece()));

async function requestDraw(signed, promise) {
  const receipt = await mine(promise);
  for (const log of receipt.logs) {
    try {
      const parsed = signed.interface.parseLog(log);
      if (parsed?.name !== 'DrawRequested') continue;
      el('live-request').value = parsed.args.id.toString();
      break;
    } catch {}
  }
}

action('live-process', async signed => {
  const request = await signed.queue(await signed.head());
  if (!request) throw new Error('No pending draw.');
  const draw = await signed.draws(request);
  if (draw.ready) await mine(signed.finishDraw(request));
  else {
    const block = await readContract.runner.getBlock('latest');
    if (BigInt(block.timestamp) < draw.at + 172800n) throw new Error('The next draw is waiting for Chainlink randomness.');
    await mine(signed.expireDraw(request));
  }
});
action('live-collect', signed => mine(signed.collectDraw(integer('live-request', 1))));
action('live-vote', signed => mine(signed.nominate(BigInt(el('live-nominee').value))));
action('live-claim', signed => mine(signed.claim()));
action('live-refund', signed => mine(signed.refund()));
action('live-close', async signed => {
  if (await signed.paidSold() < 18182n) await mine(signed.openRefunds());
  else await mine(signed.settle());
});
action('live-offer', signed => mine(signed.offerTrade(integer('live-offered', 1, 25), integer('live-wanted', 1, 25))));
action('live-accept', signed => mine(signed.acceptTrade(integer('live-trade-id', 1))));
action('live-cancel', signed => mine(signed.cancelTrade(integer('live-trade-id', 1))));
el('live-refresh').onclick = () => void refresh().catch(error => status(error.shortMessage || error.message));

async function initialize() {
  config = await fetch('/puzzle-print/config', {cache:'no-store'}).then(response => response.json());
  if (!config.address) {
    status('Paid Puzzle Print is not open. Free practice is available.');
    return;
  }
  const abi = await fetch('/puzzle-print/abi').then(response => response.json());
  const provider = new JsonRpcProvider(config.rpc, 8453, {batchMaxCount:5});
  if ((await provider.getNetwork()).chainId !== 8453n) throw new Error('Puzzle Print RPC is not on Base.');
  readContract = new Contract(config.address, abi, provider);
  settings = await readContract.setup();
  const nominees = await Promise.all(Array.from({length:Number(await readContract.recipientCount())}, (_, index) => readContract.recipients(index)));
  el('live-nominee').replaceChildren(...nominees.map((address,index) => new Option(address, index)));
  el('live-contract').href = 'https://basescan.org/address/' + config.address + '#events';
  el('live-round').hidden = false;
  status(config.paidSalesEnabled ? 'Wallet entry is available during the entry window.' : 'Read-only round. Entry controls are disabled.');
  setupWalletButton({onWalletChange:async connection => {
    account = undefined;
    walletContract = undefined;
    if (connection) {
      const browser = new BrowserProvider(connection.provider);
      if ((await browser.getNetwork()).chainId !== 8453n) throw new Error('Switch to Base.');
      const signer = await browser.getSigner(connection.address);
      account = await signer.getAddress();
      walletContract = readContract.connect(signer);
    }
    await refresh();
  }});
  await refresh();
}
initialize().catch(error => status(error.shortMessage || error.message));
