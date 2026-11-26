import {setupWalletButton} from '/wallet-button.js';
import {BrowserProvider,Contract,JsonRpcProvider,formatUnits} from '/ethers.js';
const $=id=>document.getElementById(id);
const fmt=n=>Number(formatUnits(n,6)).toLocaleString('en-US',{style:'currency',currency:'USD'});
const abi=await fetch('/abi.json').then(r=>r.json());
const cfg=await fetch('/round.json').then(r=>r.json()).catch(()=>({error:'Unable to load the raffle round. Please refresh and try again.'}));
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
        const button=document.createElement('button');button.textContent='Claim';button.onclick=()=>act(()=>past.connect(signer).claim(serial));item.append(' ',button);
      }
      list.append(item);
    }
    if(count)sections.push(list);else{let message=document.createElement('p');message.textContent='No winning serials published.';sections.push(message)}
    let receipt=document.createElement('p');receipt.textContent='Round escrow '+addr;if(cfg.chainId===8453){let a=document.createElement('a');a.href='https://basescan.org/address/'+addr+'#tokentxns';a.textContent=' View transfers';receipt.append(a)}sections.push(receipt);
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
async function refresh(){
  const [c,sold,minted,closed,deadline,places,drawTime,salesClose,postponed,freeCapacity]=await Promise.all([contract.config(),contract.sold(),contract.minted(),contract.closed(),contract.deadline(),contract.places(),contract.drawTime(),contract.salesClose(),contract.postponements(),contract.remainingFreeCapacity()]);
  $('game').hidden=false;$('edition').textContent='Round '+c.edition;$('network').textContent=cfg.local?'Local blockchain · practice funds':cfg.chainId===8453?'Base':'Chain '+cfg.chainId;
  awaitingThreshold=sold<6000n;
  targetTime=Number(awaitingThreshold?salesClose:drawTime);drawFinished=deadline>0n;
  $('time-label').textContent=awaitingThreshold?'Next sales checkpoint':minted===10000n&&!drawFinished?'Sold out · draw can start':'Draw time';
  if(minted===10000n&&!drawFinished){targetTime=0;$('countdown').textContent=''}
  tick();
  $('escrow').textContent='Round escrow '+cfg.address;
  if(cfg.chainId===8453){const link=document.createElement('a');link.href='https://basescan.org/address/'+cfg.address+'#events';link.textContent=' View draw and settlement records';$('escrow').append(link)}
  $('available').textContent=(10000-Number(minted)).toLocaleString();$('pool').textContent=fmt(sold*330000n);$('when').textContent=targetTime?new Date(targetTime*1000).toLocaleString():'';
  $('ladder').replaceChildren(...[150000n,80000n,50000n,30000n,20000n].map(rate=>{let li=document.createElement('li');li.textContent=fmt(sold*rate)+(cfg.local ? "" : " in ETH");return li}));
  if(!$('nominee').length){for(let i=0;i<Number(await contract.charityCount());i++){
    let addr=await contract.charities(i);$('nominee').add(new Option(cfg.labels?.[addr]||addr,i));
  }}
  let now=BigInt(Math.floor(Date.now()/1000));let eligible=account && await contract.eligibleUntil(account)>=now;
  let canEnter=eligible && !closed && now>=c.opens;
  $('eligibility').textContent=account?(eligible?'Wallet verified for entry.':'This wallet needs an operator eligibility attestation.'):'Connect a wallet to enter.';
  $('buy').disabled=!cfg.local||busy||!canEnter;$('free').disabled=busy||!canEnter||!freeCapacity||(account&&await contract.usedFree(account));
  let prior=await contract.previous();
  $('bonus').hidden=!(account && canEnter && freeCapacity && prior!==zero && await new Contract(prior,abi,provider).streak(account)===4n && !await contract.usedBonus(account));
  if(!historyLoaded)await loadHistory();
  $('round-notice').textContent=postponed && !closed && sold<6000n
    ? 'Round postponed. Tickets and the full pot carry forward. ' + (6000n-sold).toLocaleString() + ' more paid tickets needed. Next sales checkpoint: ' + new Date(Number(salesClose)*1000).toLocaleString() + '.'
    : '';
  if(account){let count=Number(await contract.balanceOf(account));let ids=await Promise.all(Array.from({length:count},(_,i)=>contract.tokenOfOwnerByIndex(account,i)));$('tickets').textContent=ids.map(n=>'#'+String(n).padStart(5,'0')).join(' · ')||'No tickets in this wallet.'}
  const list=[];for(let i=0;i<Number(places);i++){let id=await contract.winners(i),owner=await contract.claimant(id);let li=document.createElement('li');li.textContent='#'+id+' · '+owner+' · '+fmt(await contract.award(id));if(owner===account && deadline>=now && !await contract.claimed(id)){let b=document.createElement('button');b.textContent='Claim prize';b.onclick=()=>act(()=>contract.claim(id));li.append(' ',b)}list.push(li)}
  $('winners').replaceChildren(...list);$('receipt').textContent=deadline?'Charity recipient '+await contract.charity()+' · Claims close '+new Date(Number(deadline)*1000).toLocaleString():closed?'Entries closed.':'Draw pending.';
}
async function act(send){if(busy)return;busy=true;try{$('status').textContent='Waiting for wallet and confirmation…';let tx=await send();await tx.wait();historyLoaded=false;$('status').textContent='Confirmed '+tx.hash;}catch(e){report(e)}finally{busy=false;await refresh().catch(report)}}
$('buy').onclick = () => act(async () => {
  if (!cfg.local) throw Error('Paid entry is unavailable during the soft opening.');
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
    'function approve(address,uint256) returns(bool)'], buyerSigner);
  const price = BigInt(quantity) * 1000000n;
  if (await token.allowance(buyer, cfg.address) < price) await (await token.approve(cfg.address, price)).wait();
  if (session !== walletUpdate) throw Error('Your wallet changed. Reconnect and try again.');
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
if (cfg.local) {
  $('paid-entry').hidden = false;
  $('soft-open').hidden = true;
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
    setupWalletButton({
      local: Boolean(cfg.local),
      onConnect: cfg.local ? () => connect() : undefined,
      onWalletChange: cfg.local ? undefined : connection => useAppKitWallet(connection, provider),
      disconnectedLabel: cfg.local && !window.ethereum ? 'Use practice wallet' : 'Connect wallet'
    });
    setInterval(() => { if (!busy) refresh().catch(report); }, 20000);
  } catch (error) {
    report(error);
    setupWalletButton();
  }
}
