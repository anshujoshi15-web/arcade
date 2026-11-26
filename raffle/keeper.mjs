// Run one serialized progression loop for one configured testnet round.
import fs from 'node:fs';
import {Contract,JsonRpcProvider,Wallet} from 'ethers';
import {setTimeout as delay} from 'node:timers/promises';
const rpc=new JsonRpcProvider(process.env.RPC_URL);
const cfg=JSON.parse(fs.readFileSync('public/round.json'));
if(![31337,1337,84532].includes(cfg.chainId)||Number((await rpc.getNetwork()).chainId)!==cfg.chainId)throw Error('Network mismatch');
const round=new Contract(cfg.address,JSON.parse(fs.readFileSync('HouseRaffle.json')).abi,new Wallet(process.env.OPERATOR_KEY,rpc));
for(;;){
  try{
    if (await round.cancelled() || await round.expired()) { console.log('Round ended. The House must recover funds and issue manual refunds.'); break; }
    const now=(await rpc.getBlock('latest')).timestamp;
    const deadline=Number(await round.deadline());
    if(deadline && now>deadline){
      if(await round.outstanding())console.log((await(await round.sweep()).wait()).hash);
      break;
    }
    if(!deadline && await round.closed()){
      if(await round.seeded())console.log((await(await round.finalize()).wait()).hash);
      else if(!(await round.requestId())&&(await round.minted()===10000n||now>=Number(await round.drawTime())))console.log((await(await round.requestDraw()).wait()).hash);
    }
  }catch(error){console.error(error.shortMessage||error.message)}
  await delay(30000);
}
