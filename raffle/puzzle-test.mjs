import assert from 'node:assert/strict';
import ganache from 'ganache';
import {BrowserProvider, ContractFactory, ZeroHash} from 'ethers';
import {compile} from './build.mjs';

const source = 'contracts/PuzzlePrint.sol';
const fixture = 'contracts/PuzzlePrintTest.sol';
const mocks = 'contracts/TestServices.sol';
const artifacts = compile([source, fixture, mocks]);
const chain = ganache.provider({logging:{quiet:true}});
const provider = new BrowserProvider(chain);
provider.pollingInterval = 20;
const signers = await Promise.all([0,1,2,3,4].map(index => provider.getSigner(index)));
const [house,buyer,trader,donation,alternative] = signers;
const mine = async promise => (await promise).wait();
const advance = async seconds => {
  await chain.request({method:'evm_increaseTime',params:[seconds]});
  await chain.request({method:'evm_mine',params:[]});
};
async function deploy(file, name, ...args) {
  const artifact = artifacts[file][name];
  const contract = await new ContractFactory(artifact.abi, artifact.evm.bytecode.object, house).deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

try {
  const usd = await deploy(fixture, 'PuzzlePrintTestDollar');
  const vrf = await deploy(mocks, 'TestCoordinator');
  const charter = [donation.address, alternative.address];
  const time = Number((await chain.request({method:'eth_getBlockByNumber',params:['latest', false]})).timestamp);
  const settings = [usd.target,vrf.target,ZeroHash,1,house.address,time-1,time+8*86400];
  const print = await deploy(source,'PuzzlePrint',settings,charter,'https://arcade.thehouseofjoshi.com/puzzle-nft/');
  assert.equal(await print.uri(26),'https://arcade.thehouseofjoshi.com/puzzle-nft/26.json');
  assert.equal(await print.remaining(),25000n);
  await mine(usd.connect(buyer).faucet());
  await mine(usd.connect(buyer).approve(print.target,50_000_000n));
  await assert.rejects(print.connect(buyer).buy.staticCall(26));
  await mine(print.connect(buyer).buy(25));
  const paidId = await vrf.last();
  await mine(print.connect(trader).freePiece());
  const freeId = await vrf.last();
  await assert.rejects(print.connect(trader).freePiece.staticCall());
  await assert.rejects(print.connect(buyer).rawFulfillRandomWords.staticCall(paidId,[1]));
  await mine(vrf.deliver(freeId,777));
  await assert.rejects(print.finishDraw.staticCall(freeId));
  await mine(vrf.deliver(paidId,888));
  await mine(print.finishDraw(paidId));
  await mine(print.finishDraw(freeId));
  await assert.rejects(print.connect(trader).collectDraw.staticCall(paidId));
  await mine(print.connect(buyer).collectDraw(paidId));
  await mine(print.connect(trader).collectDraw(freeId));
  assert.equal(await print.held(buyer.address),25n);
  assert.equal(await print.pending(buyer.address),0n);
  assert.equal(await print.remaining(),24974n);
  assert.equal(await print.prizeFunded(),16_500_000n);
  await assert.rejects(print.connect(buyer).claim.staticCall());
  const duplicate = (await Promise.all(Array.from({length:25},async (_, i) =>
    await print.balanceOf(buyer.address,i+1) >= 2n ? i+1 : 0))).find(Boolean);
  const wanted = (await Promise.all(Array.from({length:25},async (_, i) =>
    await print.balanceOf(trader.address,i+1) > 0n ? i+1 : 0))).find(Boolean);
  const offered = duplicate === wanted ? (await Promise.all(Array.from({length:25},async (_, i) =>
    i+1 !== wanted && await print.balanceOf(buyer.address,i+1) >= 2n ? i+1 : 0))).find(Boolean) : duplicate;
  assert.ok(offered && wanted);
  const before = await print.balanceOf(buyer.address,wanted);
  await mine(print.connect(buyer).offerTrade(offered,wanted));
  await mine(print.connect(trader).acceptTrade(await print.offerCount()));
  assert.equal(await print.balanceOf(buyer.address,wanted),before+1n);
  assert.equal(await print.balanceOf(trader.address,offered),1n);
  await mine(print.connect(buyer).nominate(1));
  await assert.rejects(print.connect(buyer).nominate.staticCall(0));
  await advance(7*86400);
  await mine(print.connect(trader).freePiece());
  const expiring = await vrf.last();
  await advance(2*86400);
  await mine(print.expireDraw(expiring));
  await mine(print.openRefunds());
  await mine(print.connect(buyer).refund());
  assert.equal(await usd.balanceOf(buyer.address),100_000_000n);
  await assert.rejects(print.connect(buyer).refund.staticCall());

  const settlement = await deploy(fixture,'PuzzlePrintTest',[...settings.slice(0,5),time-1,time+20*86400],charter);
  // Seed a funded snapshot so tests exercise actual claims and settlement without 728 paid batches.
  await mine(settlement.fixturePaidSold(18181));
  await mine(settlement.fixtureSet(buyer.address));
  await assert.rejects(settlement.connect(buyer).claim.staticCall());
  await mine(settlement.fixturePaidSold(18182));
  await mine(usd.fixtureMint(settlement.target,36_364_000_000n));
  await mine(settlement.connect(buyer).claim());
  assert.equal(await settlement.balanceOf(buyer.address,26),1n);
  assert.equal(await settlement.held(buyer.address),0n);
  assert.equal((await settlement.winners(0)).wallet,buyer.address);
  assert.equal((await settlement.winners(0)).usdcValue,5_000_000_000n);
  await assert.rejects(settlement.connect(buyer).claim.staticCall());
  const receiptHash = '0x'+'ab'.repeat(32);
  await assert.rejects(settlement.connect(buyer).recordPayout.staticCall(1,receiptHash));
  await mine(settlement.recordPayout(1,receiptHash));
  assert.equal((await settlement.winners(0)).payout,receiptHash);
  await advance(50*86400);
  const receipt = await mine(settlement.settle());
  const event = receipt.logs.map(log => {
    try {return settlement.interface.parseLog(log);} catch {return null;}
  }).find(log => log?.name === 'Settled');
  assert.equal(event.args.recipient,donation.address);
  assert.equal(event.args.donation,12_363_760_000n);
  assert.equal(await usd.balanceOf(settlement.target),0n);
  assert.equal(await settlement.settlementBlock(),BigInt(receipt.blockNumber));
  console.log('Passed real purchase, free entry, FIFO VRF, collection, trade, nomination, expiry/refund, funded claim, receipt and settlement.');
} finally { await chain.disconnect(); }
