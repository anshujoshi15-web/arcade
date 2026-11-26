import assert from 'node:assert/strict';
import ganache from 'ganache';
import {BrowserProvider,ContractFactory} from 'ethers';
import {compile} from './build.mjs';
const round='contracts/HouseRaffle.sol', mocks='contracts/TestServices.sol';
const artifacts=compile([round,mocks]);
const chain=ganache.provider({logging:{quiet:true},wallet:{totalAccounts:67},chain:{allowUnlimitedInitCodeSize:true},miner:{blockGasLimit:50000000}});
const provider=new BrowserProvider(chain);provider.pollingInterval=20;
const account=i=>provider.getSigner(i);
const admin=await account(0),charity=await account(64),house=await account(65),donation=await account(66);
async function deploy(file,name,...args){const a=artifacts[file][name];const c=await new ContractFactory(a.abi,a.evm.bytecode.object,admin).deploy(...args);await c.waitForDeployment();return c}
const usd=await deploy(mocks,'TestDollar'),vrf=await deploy(mocks,'TestCoordinator');
async function roundContract(){const t=(await chain.request({method:'eth_getBlockByNumber',params:['latest',false]})).timestamp;return deploy(round,'HouseRaffle',[usd.target,vrf.target,'0x'+'01'.repeat(32),1,house.address,admin.address,1,Number(t)+86400,Number(t)+86401,1],[charity.address],'0x'+'00'.repeat(20),donation.address)}
async function tx(p){return(await p).wait()}
async function close(){await chain.request({method:'evm_increaseTime',params:[86500]});await chain.request({method:'evm_mine',params:[]})}
const failed=await roundContract(),buyer=await account(1);
await tx(failed.attest(buyer.address,2**40));await tx(usd.connect(buyer).faucet());await tx(usd.connect(buyer).approve(failed.target,1e6));await tx(failed.connect(buyer).buy(1,0));await close();assert.equal(await failed.closed(),false);assert.equal(await failed.postponements(),1n);
assert.equal(await usd.balanceOf(failed.target),330000n);assert.equal(await usd.balanceOf(donation.address),340000n);assert.equal(await usd.balanceOf(house.address),330000n);assert.equal(await failed.ownerOf(1),buyer.address);
await assert.rejects(failed.requestDraw.staticCall());
await tx(failed.connect(buyer).claimFree(0));
await assert.rejects(failed.connect(buyer).claimFree.staticCall(0));
await chain.request({method:'evm_increaseTime',params:[604800]});await chain.request({method:'evm_mine',params:[]});
await tx(failed.connect(buyer).claimFree(0));
assert.equal(await failed.postponements(),2n);
assert.equal(await failed.paidBy(buyer.address),1000000n);
await assert.rejects(failed.connect(buyer).emergencyClose.staticCall());
await assert.rejects(failed.connect(house).recoverFunds.staticCall());
await chain.request({method:'evm_increaseTime',params:[3*604800]});
await chain.request({method:'evm_mine',params:[]});
assert.equal(await failed.postponements(),4n);
assert.equal(await failed.expired(),true);
assert.equal(await failed.closed(),true);
await assert.rejects(failed.connect(buyer).claimFree.staticCall(0));
await assert.rejects(failed.requestDraw.staticCall());
await tx(failed.connect(house).emergencyClose());
assert.equal(await failed.cancelled(),true);
await assert.rejects(failed.connect(buyer).recoverFunds.staticCall());
const houseBeforeRecovery=await usd.balanceOf(house.address);
await tx(failed.connect(house).recoverFunds());
assert.equal(await usd.balanceOf(house.address),houseBeforeRecovery+330000n);
assert.equal(await usd.balanceOf(failed.target),0n);
await assert.rejects(failed.connect(house).recoverFunds.staticCall());
console.log('Passed four-week cutoff, House-only closure and prize escrow recovery.');
const houseBeforeRound=await usd.balanceOf(house.address);
const donationBeforeRound=await usd.balanceOf(donation.address);
const r=await roundContract(), players=new Map();
for(let i=1;i<=60;i++){
  const p=await account(i);players.set(p.address,p);
  await tx(r.attest(p.address,2**40));await tx(usd.connect(p).faucet());await tx(usd.connect(p).approve(r.target,100e6));
  for(let j=0;j<4;j++)await tx(r.connect(p).buy(25,0,{gasLimit:8000000}));
}
const free=await account(61);players.set(free.address,free);await tx(r.attest(free.address,2**40));await tx(r.connect(free).claimFree(0));await assert.rejects(r.connect(free).claimFree.staticCall(0));
assert.equal(await usd.balanceOf(r.target),1980_000000n);
assert.equal(await usd.balanceOf(donation.address),donationBeforeRound+2040_000000n);
assert.equal(await usd.balanceOf(house.address),houseBeforeRound+1980_000000n);
await close();await tx(r.requestDraw());await assert.rejects(r.connect(house).emergencyClose.staticCall());await tx(vrf.deliver(1,774));await tx(r.finalize({gasLimit:3000000}));
assert.equal(await usd.balanceOf(charity.address),0n);assert.equal(await usd.balanceOf(donation.address),donationBeforeRound+2040_000000n);assert.equal(await usd.balanceOf(house.address),houseBeforeRound+1980_000000n);
const recipients=new Set();
for(let i=0;i<5;i++){const id=await r.winners(i),owner=await r.claimant(id);recipients.add(owner);if(i===0){await tx(r.connect(players.get(owner)).transferFrom(owner,free.address,id));const before=await usd.balanceOf(house.address);await tx(r.connect(players.get(owner)).claim(id));assert.equal(await usd.balanceOf(house.address),before+900_000000n);assert.equal(await r.award(id),900_000000n)}}
assert.equal(recipients.size,5);
await chain.request({method:'evm_increaseTime',params:[31*86400]});await chain.request({method:'evm_mine',params:[]});await tx(r.sweep());assert.equal(await usd.balanceOf(r.target),0n);assert.equal(await usd.balanceOf(charity.address),1080_000000n);
// Advance a separate series one week at a time and exercise all streak milestones.
let prior='0x'+'00'.repeat(20);
for(let week=1;week<=13;week++){
  const block=await chain.request({method:'eth_getBlockByNumber',params:['latest',false]});
  const start=Number(block.timestamp);
  const current=await deploy(round,'HouseRaffle',[usd.target,vrf.target,'0x'+'01'.repeat(32),1,house.address,admin.address,start,start+86400,start+90000,week],[charity.address],prior,donation.address);
  await tx(current.attest(buyer.address,2**40));await tx(current.connect(buyer).claimFree(0));
  assert.equal(await current.streak(buyer.address),BigInt(week));
  if(week===5){await tx(current.connect(buyer).claimBonus(0));assert.equal(await current.balanceOf(buyer.address),2n)}
  if(week===8||week===12){
    const badge=new (await import('ethers')).Contract(await current.badges(),['function balanceOf(address) view returns(uint256)'],provider);
    assert.equal(await badge.balanceOf(buyer.address),1n);
  }
  if(week===13)assert.equal(await current.ownerOf(1),buyer.address);
  prior=current.target;
  await chain.request({method:'evm_increaseTime',params:[604800]});await chain.request({method:'evm_mine',params:[]});
}
console.log('Passed 13-round streak series, bonus ticket, keeper and gold badges, and priority serial.');
console.log('Passed rollover, 6000 paid mints, free entry, VRF callback, 5 distinct winners, per-purchase splits, snapshot claim and expiry sweep.');await chain.disconnect();
