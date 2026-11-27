import { playSound } from './game-sounds.mjs';
import {formatUtc} from '/utc-time.js';
import {setupWalletButton} from '/wallet-button.js';
import {BrowserProvider,Contract,JsonRpcProvider,formatUnits} from '/ethers.js';
const $=id=>document.getElementById(id);
const fmt=n=>Number(formatUnits(n,6)).toLocaleString('en-US',{style:'currency',currency:'USD'});
const abi=await fetch('/abi.json').then(r=>r.json());
const cfg=await fetch('/round.json').then(r=>r.json()).catch(()=>({error:'Unable to load the raffle round. Please refresh and try again.'}));
const paidEntryEnabled = cfg.local === true || cfg.paidSalesEnabled === true;
let provider,contract,signer,account,busy=false,historyLoaded=false;
let targetTime=0,drawFinished=false,awaitingThreshold=false;
function tick(){
  if(!targetTime)return;
  const left=Math.max(0,targetTime-Math.floor(Date.now()/1000));
  $('countdown').textContent=drawFinished?'Draw settled':left?Math.floor(left/86400)+'d '+Math.floor(left%86400/3600)+'h '+Math.floor(left%3600/60)+'m '+left%60+'s':awaitingThreshold?'Checkpoint due':'Draw due';
}
setInterval(tick,1000);
const zero='0x'+'00'.repeat(20);
async function loadHistory(){
  const box=$('history');const sections=[];let addr=await contract.previous();
  while(addr!==zero){
    const past=new Contract(addr,abi,provider),c=await past.config();
    let h=document.createElement('h3');h.textContent='Round '+c.edition;sections.push(h);
    const count=Number(await past.places()),list=document.createElement('ol');
    for(let i=0;i<count;i++){const serial=await past.winners(i);let item=document.createElement('li');item.textContent='#'+serial+' · '+await past.claimant(serial)+' · '+fmt(await past.award(serial));
      if(account===await past.claimant(serial) && await past.deadline()>=BigInt(Math.floor(Date.now()/1000)) && !await past.claimed(serial)){
        const button=document.createElement('button');button.textContent='Register ETH prize claim';button.onclick=()=>act(()=>past.connect(signer).claim(serial),'jackpot');item.append(' ',button);
      }
      list.append(item);
    }
    if(count)sections.push(list);else{let message=document.createElement('p');message.textContent='No winning serials published.';sections.push(message)}
    let receipt=document.createElement('p');receipt.textContent='Raffle ticket contract '+addr;if(cfg.chainId===8453){let a=document.createElement('a');a.href='https://basescan.org/address/'+addr+'#tokentxns';a.textContent=' View transfers';receipt.append(a)}sections.push(receipt);
    addr=await past.previous();
  }
  box.replaceChildren(...sections);if(!sections.length)box.textContent='This is the first linked round.';
  historyLoaded=true;
}
function report(error){$('status').textContent=error.shortMessage||error.message;}
async function connect(authorizedAddress){
  if(cfg.local && !window.ethereum){
    provider=new JsonRpcProvider(cfg.rpc);signer=await provider.getSigner(1);account=await signer.getAddress();
    contract=new Contract(cfg.address,abi,signer);historyLoaded=false;
    await refresh();return account;
  }
  if(!window.ethereum)throw Error('Open this page in a browser with an Ethereum wallet.');
  if(cfg.local && !authorizedAddress){
    try{await window.ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x7a69'}]})}
    catch(e){if(e.code!==4902)throw e;await window.ethereum.request({method:'wallet_addEthereumChain',params:[{chainId:'0x7a69',chainName:'House Raffle Local',nativeCurrency:{name:'Practice Ether',symbol:'ETH',decimals:18},rpcUrls:[cfg.rpc]}]})}
  }
  provider=new BrowserProvider(window.ethereum);
  if(!authorizedAddress) await provider.send('eth_requestAccounts',[]);
  if(Number((await provider.getNetwork()).chainId)!==cfg.chainId)throw Error('Switch your wallet to chain '+cfg.chainId+' and reconnect.');
  signer=await provider.getSigner(authorizedAddress);account=await signer.getAddress();
  if(cfg.local){
    const response=await fetch('/local-enroll',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address:account})});
    if(!response.ok)throw Error('Local test wallet enrollment failed.');
  }
  historyLoaded=false;contract=new Contract(cfg.address,abi,signer);await refresh();return account;
}
async function showOwnedTickets() {
  const wallet = account;
  const currentContract = contract;
  const container = $('tickets');
  if (!wallet) {
    container.textContent = 'Connect your wallet to see your tickets.';
    return;
  }

  const count = Number(await currentContract.balanceOf(wallet));
  const ids = await Promise.all(Array.from({length: count}, (_, index) =>
    currentContract.tokenOfOwnerByIndex(wallet, index)));
  if (wallet !== account || currentContract !== contract) return;
  if (!ids.length) {
    container.textContent = 'No tickets in this wallet.';
    return;
  }

  const list = document.createElement('ul');
  list.className = 'owned-tickets';
  const address = cfg.address.toLowerCase();
  for (const id of ids) {
    const item = document.createElement('li');
    const serial = '#' + String(id).padStart(5, '0');
    const label = document.createElement('strong');
    label.textContent = serial;
    item.append(label);
    if (cfg.chainId === 8453) {
      const link = document.createElement('a');
      link.href = 'https://basescan.org/nft/' + address + '/' + id;
      link.textContent = 'BaseScan';
      link.setAttribute('aria-label', 'View ticket ' + serial + ' on BaseScan');
      item.append(link);
    }
    list.append(item);
  }
  container.replaceChildren(list);
}

function showAddress(id, label, address, fragment = '') {
  const field = $(id);
  field.textContent = label + ': ';
  if (!address || cfg.chainId !== 8453) {
    field.append(address || 'Unavailable for this contract');
    return;
  }
  const link = document.createElement('a');
  link.href = 'https://basescan.org/address/' + address + fragment;
  link.textContent = address;
  link.style.overflowWrap = 'anywhere';
  field.append(link);
}

async function refresh(){
  const [donation,c,sold,minted,closed,deadline,places,drawTime,salesClose,postponed,freeCapacity,cancelled,expired,publicPaidEntry]=await Promise.all([contract.donationWallet().catch(()=>null),contract.config(),contract.sold(),contract.minted(),contract.closed(),contract.deadline(),contract.places(),contract.drawTime(),contract.salesClose(),contract.postponements(),contract.remainingFreeCapacity(),contract.cancelled().catch(()=>false),contract.expired().catch(()=>false),contract.publicPaidEntry().catch(()=>false)]);
  $('paid-progress').value = Math.min(Number(sold), 6000);
  $('paid-progress-label').textContent = sold.toLocaleString('en-US') + (sold >= 6000n ? ' paid tickets · threshold met' : ' of 6,000 paid tickets');
  $('pool-updated').textContent = 'Updated ' + formatUtc(Date.now() / 1000);
  $('sales-checkpoint').textContent = formatUtc(salesClose);
  $('scheduled-draw').textContent = cancelled ? 'Cancelled' : expired ? 'Threshold missed · awaiting formal closure' :
    formatUtc(drawTime) + (awaitingThreshold ? ' · subject to the paid-ticket threshold' : '');
  $('opens-at').textContent = formatUtc(c.opens);
  $('game').hidden=false;$('edition').textContent='Round '+c.edition;$('network').textContent=cfg.local?'Local blockchain · practice funds':cfg.chainId===8453?'Base':'Chain '+cfg.chainId;
  awaitingThreshold=sold<6000n;
  targetTime=Number(awaitingThreshold?salesClose:drawTime);drawFinished=deadline>0n;
  $('time-label').textContent=awaitingThreshold?'Next sales checkpoint':minted===10000n&&!drawFinished?'Sold out · draw can start':'Draw time';
  if(minted===10000n&&!drawFinished){targetTime=0;$('countdown').textContent=''}
  tick();
  showAddress('escrow', 'Raffle ticket contract', cfg.address, '#events');
  showAddress('house-wallet', 'House wallet', c.house);
  showAddress('donation-wallet', 'Donation wallet', donation);
  $('available').textContent=(10000-Number(minted)).toLocaleString();$('pool').textContent=fmt(sold*330000n);$('when').textContent=targetTime?formatUtc(targetTime):'';
  if(!$('nominee').length){for(let i=0;i<Number(await contract.charityCount());i++){
    let addr=await contract.charities(i);$('nominee').add(new Option(cfg.labels?.[addr]||addr,i));
  }}
  let now=BigInt(Math.floor(Date.now()/1000));let eligible=account && await contract.eligibleUntil(account)>=now;
  const open = !closed && now >= c.opens;
  const wallet = account;
  const atWalletLimit = wallet && (await Promise.all([contract.issued(wallet), contract.balanceOf(wallet)]))
    .some(count => count >= 100n);
  if (wallet !== account) return;
  const canEnter = eligible && open && !atWalletLimit;
  const isOperator = account && [c.house, c.registrar].some(address => address.toLowerCase() === account.toLowerCase());
  const canBuy = account && open && !atWalletLimit && (eligible || (publicPaidEntry && !isOperator));
  const freeUsed = canEnter && freeCapacity && await contract.usedFree(account);
  const paidStatus = !paidEntryEnabled ? 'unavailable' : canBuy ? 'available' : 'requires wallet approval';
  const freeStatus = !eligible ? 'requires wallet approval' : !freeCapacity ? 'entry limit reached' :
    freeUsed ? 'already claimed this week' : 'available';
  $('eligibility').textContent = cancelled ? 'Round cancelled. Free entries are void.' :
    !open ? (closed ? 'Round closed to entries.' : 'Entries have not opened yet.') :
    !account ? 'Connect your wallet to check paid and free entry.' :
    isOperator ? 'House and registrar wallets cannot enter.' :
    atWalletLimit ? 'This wallet has reached the 100-ticket limit.' :
    'Paid entry: ' + paidStatus + '. Free entry: ' + freeStatus + '.';
  $('buy').disabled = !paidEntryEnabled || busy || !canBuy;
  $('free').disabled = busy || !canEnter || !freeCapacity || freeUsed;
  let prior=await contract.previous();
  $('bonus').hidden=!(account && canEnter && freeCapacity && prior!==zero && await new Contract(prior,abi,provider).streak(account)===4n && !await contract.usedBonus(account));
  if(!historyLoaded)await loadHistory();
  $('round-notice').textContent=cancelled ? 'Round ended by the House. Free entries are void. Full USDC refunds will be sent to original buyers.' : expired ? 'The four-week limit has been reached. Entries are closed and the round is awaiting formal closure by the House.' : postponed && !closed && sold<6000n
    ? 'Round postponed. Tickets and the full prize pot carry forward. ' + (6000n-sold).toLocaleString() + ' more paid tickets needed. Next sales checkpoint: ' + formatUtc(salesClose) + '.'
    : '';
  await showOwnedTickets();
  const list=[];for(let i=0;i<Number(places);i++){let id=await contract.winners(i),owner=await contract.claimant(id);let li=document.createElement('li');li.textContent='#'+id+' · '+owner+' · '+fmt(await contract.award(id));if(owner===account && deadline>=now && !await contract.claimed(id)){let b=document.createElement('button');b.textContent='Register ETH prize claim';b.onclick=()=>act(()=>contract.claim(id),'jackpot');li.append(' ',b)}list.push(li)}
  $('winners').replaceChildren(...list);$('receipt').textContent=deadline?'Charity recipient '+await contract.charity()+' · Claims close '+formatUtc(deadline):closed?'Entries closed.':'Draw pending.';
}
async function act(send, successSound = 'ticket') {
  if (busy) return;
  busy = true;
  playSound('pending');
  try {
    $('status').textContent = 'Waiting for wallet and confirmation…';
    const tx = await send();
    await tx.wait();
    historyLoaded = false;
    $('status').textContent = 'Confirmed ' + tx.hash;
    playSound(successSound);
  } catch (error) {
    playSound('miss');
    report(error);
  } finally {
    busy = false;
    await refresh().catch(report);
  }
}
$('buy').onclick = () => act(async () => {
  if (!paidEntryEnabled) throw Error('Paid entry is disabled for this round.');
  const quantity = Number($('qty').value);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 25) throw Error('Enter 1–25 tickets.');
  const nominee = Number($('nominee').value);
  const buyer = account;
  const buyerSigner = signer;
  const raffle = contract;
  const session = walletUpdate;
  if (!buyer || !buyerSigner) throw Error('Connect a wallet first.');
  const {currency} = await raffle.config();
  const token = new Contract(currency, ['function allowance(address,address) view returns(uint256)',
    'function approve(address,uint256) returns(bool)', 'function balanceOf(address) view returns(uint256)'], buyerSigner);
  const price = BigInt(quantity) * 1000000n;
  if (await token.balanceOf(buyer) < price) throw Error('You need ' + quantity + ' USDC on Base for this purchase.');
  if (await token.allowance(buyer, cfg.address) < price) await (await token.approve(cfg.address, price)).wait();
  if (session !== walletUpdate) throw Error('Your wallet changed. Reconnect and try again.');
  await raffle.buy.staticCall(quantity, nominee);
  return raffle.buy(quantity, nominee);
});
$('bonus').onclick=()=>act(()=>contract.claimBonus(Number($('nominee').value)));$('free').onclick=()=>act(()=>contract.claimFree(Number($('nominee').value)));
if (cfg.local) {
  window.ethereum?.on?.('accountsChanged',()=>location.reload());
  window.ethereum?.on?.('chainChanged',()=>location.reload());
}
let walletUpdate = 0;
async function useAppKitWallet(connection, readProvider) {
  const update = ++walletUpdate;
  signer = undefined;
  account = undefined;
  contract = new Contract(cfg.address, abi, readProvider);
  historyLoaded = false;
  for (const id of ['buy', 'free', 'bonus']) $(id).disabled = true;
  $('tickets').textContent = '';
  let nextSigner;
  let nextAddress;
  let walletError;
  try {
    if (connection) {
      const browser = new BrowserProvider(connection.provider);
      if (Number((await browser.getNetwork()).chainId) !== cfg.chainId) {
        throw Error('Switch to Base to enter this round.');
      }
      nextSigner = await browser.getSigner(connection.address);
      nextAddress = await nextSigner.getAddress();
    }
  } catch (error) { walletError = error; }
  if (update !== walletUpdate) return;
  if (nextAddress) {
    signer = nextSigner;
    account = nextAddress;
    contract = new Contract(cfg.address, abi, signer);
  }
  await refresh();
  if (walletError && update === walletUpdate) throw walletError;
}
if (paidEntryEnabled && cfg.address) {
  $('paid-entry').hidden = false;
}
if (!cfg.address) {
  $('status').textContent = cfg.error || 'No raffle round is open yet. Check back for the next round.';
  setupWalletButton();
} else {
  try {
    provider = new JsonRpcProvider(cfg.rpc);
    if (Number((await provider.getNetwork()).chainId) !== cfg.chainId) throw Error('Round RPC network mismatch.');
    contract = new Contract(cfg.address, abi, provider);
    await refresh();
    $('status').textContent = 'Round loaded.';
    if (location.hash === '#entry-status') $('entry-status').scrollIntoView();
    setupWalletButton({
      local: Boolean(cfg.local),
      onConnect: cfg.local ? () => connect() : undefined,
      onWalletChange: cfg.local ? undefined : connection => useAppKitWallet(connection, provider),
      disconnectedLabel: cfg.local && !window.ethereum ? 'Use practice wallet' : 'Connect wallet'
    });
    setInterval(() => { if (!busy && !document.hidden) refresh().catch(report); }, 15000);
  } catch (error) {
    report(error);
    setupWalletButton();
  }
}
