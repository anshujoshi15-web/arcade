import {weeklySchedule} from './schedule.mjs';
import fs from 'node:fs';
import {JsonRpcProvider,Contract,ContractFactory,Wallet,getAddress} from 'ethers';
const net=new JsonRpcProvider(process.env.RPC_URL),wallet=new Wallet(process.env.OPERATOR_KEY,net);
const a=JSON.parse(fs.readFileSync('HouseRaffle.json'));
const [cmd,arg,value]=process.argv.slice(2);
const chain=Number((await net.getNetwork()).chainId);
if(![84532,31337,1337].includes(chain))throw Error('This deployment workflow targets Base Sepolia or a local test chain.');
if(cmd==='deploy'){
  const config=JSON.parse(fs.readFileSync(arg));
  Object.assign(config.round,weeklySchedule(config.monday));
  if(!config.publicRpc)throw Error('A public RPC URL is required for players');
  const r=await new ContractFactory(a.abi,a.evm.bytecode.object,wallet).deploy(config.round,config.charities,config.previous||'0x'+'00'.repeat(20),config.donationWallet);
  await r.waitForDeployment();
  fs.writeFileSync('public/round.json',JSON.stringify({address:r.target,chainId:chain,rpc:config.publicRpc,labels:config.labels},null,2));
  console.log(r.target);
}else{
  const config=JSON.parse(fs.readFileSync('public/round.json'));if(config.chainId!==chain)throw Error('Wrong chain');
  const r=new Contract(config.address,a.abi,wallet);
  let tx;
  if(cmd==='attest')tx=await r.attest(getAddress(arg),BigInt(value));
  else if(cmd==='advance'){
    if(await r.deadline()){console.log('Draw settled');process.exit(0)}
    if(await r.seeded())tx=await r.finalize();
    else if(await r.requestId()){console.log('Waiting for coordinator');process.exit(0)}
    else tx=await r.requestDraw();
  }else if(cmd==='sweep')tx=await r.sweep();else throw Error('Expected deploy, attest, advance or sweep');
  console.log((await tx.wait()).hash);
}
