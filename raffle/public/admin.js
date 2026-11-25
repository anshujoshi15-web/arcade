import { BrowserProvider, Contract, JsonRpcProvider, ZeroAddress, getAddress } from '/ethers.js';

const field = id => document.getElementById(id);
const status = message => { field('status').textContent = message; };
const errorText = error => error.shortMessage || error.message;
let round, walletRound, walletAddress, chainId, busy = false;

const actions = ['draw', 'finalize', 'sweep', 'grant', 'revoke'];
function disableActions() {
  for (const action of actions) field(action).disabled = true;
}

async function refresh() {
  disableActions();
  const [config, sold, minted, closed, request, seeded, deadline, outstanding, places] = await Promise.all([
    round.config(), round.sold(), round.minted(), round.closed(), round.requestId(),
    round.seeded(), round.deadline(), round.outstanding(), round.places()
  ]);
  const block = await round.runner.getBlock('latest');
  const now = BigInt(block.timestamp);
  const phase = deadline ? 'Settled' : seeded ? 'Ready to finalize' : request ? 'Waiting for VRF' :
    closed ? (sold < 6000n ? 'Closed · refunds available' : 'Closed · draw pending') :
    now < config.opens ? 'Scheduled' : 'Entries open';
  const details = {
    Contract: await round.getAddress(),
    Network: String(chainId),
    Round: String(config.edition),
    Status: phase,
    'Paid tickets': sold.toString(),
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
  if (!walletRound || busy) return;
  field('draw').disabled = !(sold >= 6000n && !request && (now >= config.drawAt || minted === 10000n));
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

field('refresh').onclick = () => refresh().catch(error => status(errorText(error)));
field('draw').onclick = () => send('requestDraw');
field('finalize').onclick = () => send('finalize');
field('sweep').onclick = () => send('sweep');
field('eligibility').onsubmit = event => {
  event.preventDefault();
  try {
    const player = getAddress(field('player').value.trim());
    if (player === ZeroAddress) throw new Error('Enter a player wallet address.');
    const revoke = event.submitter?.value === 'revoke';
    const expiry = Math.floor(new Date(field('expiry').value).getTime() / 1000);
    if (!revoke && (!Number.isFinite(expiry) || expiry <= Date.now() / 1000)) throw new Error('Choose a future expiry.');
    void send('attest', player, revoke ? 0 : expiry);
  } catch (error) { status(errorText(error)); }
};
initialize().catch(error => status(errorText(error)));
