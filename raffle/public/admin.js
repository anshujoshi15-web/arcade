import {formatUtc} from '/utc-time.js';
import { BrowserProvider, Contract, JsonRpcProvider, ZeroAddress, getAddress, formatUnits, parseEther } from '/ethers.js';

const field = id => document.getElementById(id);
const status = message => { field('status').textContent = message; };
const errorText = error => error.shortMessage || error.message;
let round, walletRound, walletAddress, chainId, busy = false;

const vrfSubscriptionAbi = ['function getSubscription(uint256) view returns (uint96 balance, uint96 nativeBalance, uint64 reqCount, address subOwner, address[] consumers)'];
const usdc = amount => formatUnits(amount, 6) + ' USDC';
let withdrawal;
let buyerLedger = [];
let claimLedger = [];

const actions = ['cancel-round', 'recover-funds', 'draw', 'finalize', 'sweep', 'grant', 'revoke'];
function disableActions() {
  withdrawal = undefined;
  for (const action of actions) field(action).disabled = true;
}

async function refresh() {
  disableActions();
  const [config, sold, minted, closed, request, seeded, deadline, outstanding, places, drawTime, postponed, cancelled, expired] = await Promise.all([
    round.config(), round.sold(), round.minted(), round.closed(), round.requestId(),
    round.seeded(), round.deadline(), round.outstanding(), round.places(), round.drawTime(), round.postponements(), round.cancelled().catch(()=>null), round.expired().catch(()=>false)
  ]);
  const block = await round.runner.getBlock('latest');
  const now = BigInt(block.timestamp);
  const address = await round.getAddress();
  const currency = new Contract(config.currency, ['function balanceOf(address) view returns(uint256)'], round.runner);
  const coordinator = new Contract(config.coordinator, vrfSubscriptionAbi, round.runner);
  const [escrow, salesClose, cutoff, donationWallet, donationRecipient, subscription] = await Promise.all([
    currency.balanceOf(address), round.salesClose(), round.postponementLimit().catch(() => null), round.donationWallet().catch(() => null), round.charity(),
    coordinator.getSubscription(config.subscription).catch(() => null)
  ]);
  const phase = cancelled ? 'Ended · manual refunds' : expired ? 'Four-week limit reached · end round to recover funds' : deadline ? 'Settled' : seeded ? 'Ready to finalize' : request ? 'Waiting for VRF' :
    closed ? 'Closed · draw pending' : postponed && sold < 6000n ? 'Postponed · sales open' :
    now < config.opens ? 'Scheduled' : 'Entries open';
  const details = {
    Contract: address,
    Network: String(chainId),
    Round: String(config.edition),
    Status: phase,
    'Contract escrow balance': usdc(escrow),
    'Gross ticket payments': usdc(sold * 1000000n),
    ...(donationWallet ? {
      'Donation wallet': donationWallet,
      'Selected donation recipient': donationRecipient === ZeroAddress ? 'Selected at settlement' : donationRecipient,
      'Donation allocation transferred': usdc(sold * 340000n),
      'House allocation transferred': usdc(sold * 330000n)
    } : {}),
    'Prize allocation': usdc(sold * 330000n),
    'Paid tickets': sold.toString(),
    'Paid tickets still needed': (sold < 6000n ? 6000n - sold : 0n).toString(),
    'Postponements used': postponed.toString() + ' of 4',
    'Entries open': formatUtc(config.opens),
    'Sales checkpoint': formatUtc(salesClose),
    'Four-week cutoff': cutoff ? formatUtc(cutoff) : 'Unavailable for this contract',
    'Draw time': formatUtc(drawTime),
    'VRF subscription': String(config.subscription),
    'VRF LINK balance': subscription ? formatUnits(subscription.balance, 18) + ' LINK' : 'Unavailable',
    'VRF consumer': subscription ? subscription.consumers.some(consumer => consumer.toLowerCase() === address.toLowerCase()) ?
      'Raffle registered' : 'Raffle missing from subscription' : 'Unavailable',
    'Claim deadline': deadline ? formatUtc(deadline) : 'Opens after settlement',
    'House wallet': config.house,
    'Total minted': minted.toString(),
    'Winners selected': places.toString(),
    Registrar: config.registrar,
    'Connected wallet': walletAddress || 'Connect a wallet to submit transactions'
  };
  field('round').replaceChildren(...Object.entries(details).flatMap(([label, value]) => {
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value;
    return [term, description];
  }));
  const registered = subscription?.consumers.some(consumer => consumer.toLowerCase() === address.toLowerCase());
  field('vrf-status').textContent = !subscription ? 'Could not read the VRF subscription. Check it in Chainlink before requesting the draw.' :
    !registered ? 'Add this raffle as a consumer before requesting the draw.' :
    subscription.balance === 0n ? 'Fund the subscription with Base LINK before requesting the draw.' :
    'LINK is present. Check the recommended subscription balance in Chainlink before requesting the draw.';
  field('withdrawal-balance').textContent = usdc(escrow);
  field('withdrawal-status').textContent = cancelled === null ? 'Withdrawal status is unavailable for this contract.' :
    cancelled !== true ? 'Withdrawals are available after the House cancels the round.' :
    escrow === 0n ? 'There is no USDC left to withdraw.' :
    'The full balance is available for refunds. Destination: ' + config.house + '.';
  if (!walletRound || busy) return;
  const isHouse = walletAddress.toLowerCase() === config.house.toLowerCase();
  field('cancel-round').disabled = !isHouse || cancelled !== false || Boolean(request);
  if (isHouse && cancelled === true && escrow > 0n) {
    withdrawal = {escrow, house: config.house};
    field('recover-funds').disabled = false;
  }
  field('draw').disabled = (subscription && (!registered || subscription.balance === 0n)) || !isHouse || cancelled === true || !(sold >= 6000n && !request && (now >= drawTime || minted === 10000n));
  field('finalize').disabled = !seeded || Boolean(deadline);
  field('sweep').disabled = !(deadline && now > deadline && outstanding);
  const isRegistrar = walletAddress.toLowerCase() === config.registrar.toLowerCase();
  field('grant').disabled = field('revoke').disabled = !isRegistrar;
}

async function send(method, ...args) {
  if (busy || !walletRound) return;
  busy = true;
  field('connect').disabled = true;
  field('refresh').disabled = true;
  disableActions();
  try {
    status('Review the transaction in your wallet.');
    if (method === 'recoverFunds') await walletRound.recoverFunds.staticCall();
    const tx = await walletRound[method](...args);
    status('Waiting for confirmation…');
    await tx.wait();
    status('Confirmed ' + tx.hash);
  } catch (error) {
    status(errorText(error));
  } finally {
    busy = false;
    field('connect').disabled = false;
    field('refresh').disabled = false;
    await refresh().catch(error => status(errorText(error)));
  }
}

async function loadJson(path) {
  const response = await fetch(path, {cache:'no-store'});
  if (!response.ok) throw new Error('Unable to load ' + path);
  return response.json();
}

async function initialize() {
  const [config, abi] = await Promise.all([loadJson('/round.json'), loadJson('/abi.json')]);
  if (!config.address || !config.rpc || !config.chainId) {
    field('withdrawal-balance').textContent = 'Unavailable';
    status('Set PUBLIC_ROUND on the Node.js host to connect this page to a deployed raffle.');
    return;
  }
  chainId = BigInt(config.chainId);
  const provider = new JsonRpcProvider(config.rpc);
  if ((await provider.getNetwork()).chainId !== chainId) throw new Error('Configured RPC is on the wrong network.');
  round = new Contract(getAddress(config.address), abi, provider);
  await refresh();
  status('Round loaded. Connect an operator wallet to manage it.');
  field('refresh').disabled = false;
  field('connect').disabled = false;
  field('load-ledger').disabled = false;
  field('verify-payout').disabled = chainId !== 8453n;
  if (config.deploymentBlock !== undefined) field('ledger-block').value = config.deploymentBlock;
  field('connect').onclick = async () => {
    try {
      if (!window.ethereum) throw new Error('Open this page in a browser with an Ethereum wallet.');
      const browser = new BrowserProvider(window.ethereum);
      await browser.send('eth_requestAccounts', []);
      if ((await browser.getNetwork()).chainId !== chainId) throw new Error('Switch your wallet to chain ' + chainId + ' and reconnect.');
      const signer = await browser.getSigner();
      const address = await signer.getAddress();
      if (address.toLowerCase() !== '0x6736d2ea9807297f0e56967361b9410854b86a5f') {
        throw new Error('Switch to the House wallet to manage this round.');
      }
      walletAddress = address;
      walletRound = round.connect(signer);
      await refresh();
      status('Operator wallet connected.');
    } catch (error) { status(errorText(error)); }
  };
  window.ethereum?.on?.('chainChanged', () => location.reload());
  window.ethereum?.on?.('accountsChanged', () => location.reload());
}

function tableRows(id, rows) {
  field(id).replaceChildren(...rows.map(row => {
    const tr = document.createElement('tr');
    for (const value of row) {
      const cell = tr.insertCell();
      cell.textContent = value;
    }
    return tr;
  }));
}

function downloadCsv(filename, headings, rows) {
  const escape = value => '"' + String(value).replaceAll('"', '""') + '"';
  const csv = [headings, ...rows].map(row => row.map(escape).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function loadLedger(event) {
  event.preventDefault();
  const status = field('ledger-status');
  const start = field('ledger-block').valueAsNumber;
  field('load-ledger').disabled = true;
  field('download-buyers').disabled = field('download-claims').disabled = true;
  tableRows('buyers', []);
  tableRows('claims', []);
  try {
    const latest = await round.runner.getBlockNumber();
    if (!Number.isSafeInteger(start) || start < 0 || start > latest) throw new Error('Enter a valid deployment block.');
    const totals = new Map();
    const claims = [];
    const entryTopic = round.interface.getEvent('Entry').topicHash;
    const claimTopic = round.interface.getEvent('PrizeClaimed').topicHash;
    const address = await round.getAddress();
    const paidSales = await round.sold({blockTag:latest});
    for (let fromBlock = start; fromBlock <= latest; fromBlock += 1000) {
      const toBlock = Math.min(fromBlock + 999, latest);
      status.textContent = 'Reading blocks ' + fromBlock + '–' + toBlock + ' of ' + latest + '…';
      const logs = await round.runner.getLogs({address, fromBlock, toBlock, topics:[[entryTopic, claimTopic]]});
      for (const log of logs) {
        const entry = round.interface.parseLog(log);
        if (entry.name === 'Entry' && !entry.args.free) {
          const buyer = entry.args.wallet;
          totals.set(buyer, (totals.get(buyer) || 0n) + entry.args.count);
        }
        if (entry.name === 'PrizeClaimed') {
          claims.push([entry.args.serial.toString().padStart(5, '0'), entry.args.recipient,
            formatUnits(entry.args.usdcValue, 6), log.transactionHash]);
        }
      }
    }
    const total = [...totals.values()].reduce((sum, count) => sum + count, 0n);
    if (total !== paidSales) throw new Error('Ledger total does not match on-chain paid sales. Check the deployment block and retry.');
    buyerLedger = [...totals].map(([buyer, count]) => [buyer, count.toString(), count.toString()]);
    claimLedger = claims;
    tableRows('buyers', buyerLedger);
    tableRows('claims', claimLedger);
    field('download-buyers').disabled = !buyerLedger.length;
    field('download-claims').disabled = !claimLedger.length;
    status.textContent = 'Through block ' + latest + ' · ' + buyerLedger.length + ' buyers · ' + claimLedger.length + ' registered claims.';
  } catch (error) {
    status.textContent = errorText(error);
  } finally {
    field('load-ledger').disabled = false;
  field('verify-payout').disabled = chainId !== 8453n;
  }
}

field('ledger-form').onsubmit = loadLedger;
field('download-buyers').onclick = () => downloadCsv('raffle-buyers.csv', ['Buyer wallet','Paid tickets','Paid USDC','Refund transaction'], buyerLedger.map(row => [...row, '']));
field('download-claims').onclick = () => downloadCsv('raffle-eth-claims.csv', ['Serial','Snapshot wallet','USDC prize value','Claim transaction','Conversion rate','ETH payout transaction'], claimLedger.map(row => [...row, '', '']));

field('refresh').onclick = () => refresh().catch(error => status(errorText(error)));
field('cancel-round').onclick = () => {
  if (window.confirm('Cancel this round permanently? Entries and the draw will stop. The House must refund buyers in full.')) void send('emergencyClose');
};
field('recover-funds').onclick = () => {
  if (!withdrawal || field('recover-funds').disabled) return;
  const {escrow, house} = withdrawal;
  if (window.confirm('Withdraw the full USDC balance (currently ' + usdc(escrow) +
    ') to the House wallet ' + house + ' for manual refunds?')) void send('recoverFunds');
};
field('draw').onclick = () => send('requestDraw');
field('finalize').onclick = () => send('finalize');
field('sweep').onclick = () => send('sweep');
field('eligibility').onsubmit = event => {
  event.preventDefault();
  try {
    const player = getAddress(field('player').value.trim());
    if (player === ZeroAddress) throw new Error('Enter a player wallet address.');
    const revoke = event.submitter?.value === 'revoke';
    const expiry = Math.floor(Date.parse(field('expiry').value + 'Z') / 1000);
    if (!revoke && (!Number.isFinite(expiry) || expiry <= Date.now() / 1000)) throw new Error('Choose a future expiry.');
    void send('attest', player, revoke ? 0 : expiry);
  } catch (error) { status(errorText(error)); }
};
initialize().catch(error => {
  field('withdrawal-balance').textContent = 'Unavailable';
  status(errorText(error));
});

field('load-support').onclick = async () => {
  const button = field('load-support');
  const feedback = field('support-admin-status');
  const list = field('support-reports');
  button.disabled = true;
  feedback.textContent = 'Loading support reports…';
  try {
    const response = await fetch('/admin/support-reports', {cache:'no-store'});
    if (response.status === 401) throw new Error('Your admin session expired. Sign in again.');
    if (!response.ok) throw new Error('Unable to load support reports.');
    const {reports} = await response.json();
    list.replaceChildren(...reports.map(report => {
      const item = document.createElement('details');
      const title = document.createElement('summary');
      title.textContent = formatUtc(Date.parse(report.createdAt) / 1000) + ' · ' + report.id;
      const message = document.createElement('p');
      message.textContent = report.message;
      message.style.whiteSpace = 'pre-wrap';
      message.style.overflowWrap = 'anywhere';
      item.append(title, message);
      if (report.email) {
        const email = document.createElement('p');
        email.textContent = 'Reply to ' + report.email;
        item.append(email);
      }
      return item;
    }));
    feedback.textContent = reports.length ? reports.length + ' reports loaded.' : 'No reports yet.';
  } catch (error) {
    list.replaceChildren();
    feedback.textContent = errorText(error);
  } finally {
    button.disabled = false;
  }
};

field('payout-verification').onsubmit = async event => {
  event.preventDefault();
  if (!round || chainId !== 8453n) return;
  const button = field('verify-payout');
  const output = field('payout-verification-status');
  button.disabled = true;
  output.textContent = 'Checking Base transaction…';
  try {
    const hash = field('payout-hash').value.trim();
    if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error('Enter a Base transaction hash.');
    const recipient = getAddress(field('payout-wallet').value.trim());
    const amount = parseEther(field('payout-amount').value.trim());
    if (amount <= 0n) throw new Error('Enter a positive ETH amount.');
    const [tx, receipt] = await Promise.all([round.runner.getTransaction(hash), round.runner.getTransactionReceipt(hash)]);
    if (!tx || !receipt) throw new Error('Transaction is missing or pending on Base.');
    if (receipt.status !== 1) throw new Error('The Base transaction failed.');
    const {house} = await round.config();
    if (tx.from.toLowerCase() !== house.toLowerCase() ||
        tx.to?.toLowerCase() !== recipient.toLowerCase() || tx.value !== amount || tx.data !== '0x') {
      throw new Error('This transaction does not match the expected direct ETH payment from the House wallet.');
    }
    const link = document.createElement('a');
    link.href = 'https://basescan.org/tx/' + hash;
    link.textContent = 'View receipt on BaseScan';
    output.replaceChildren('Verified direct transfer of ' + formatUnits(amount, 18) + ' Base ETH to ' + recipient + '. ', link);
  } catch (error) {
    output.textContent = errorText(error);
  } finally {
    button.disabled = false;
  }
};
