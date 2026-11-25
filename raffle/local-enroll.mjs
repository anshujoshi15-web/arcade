// Enabled exclusively by the loopback development chain launcher.
import {getAddress,parseEther} from 'ethers';
let setup;
let queue=Promise.resolve();
export function enableLocalEnrollment(context){setup=context}
export async function enroll(req,res){
  if(!setup||req.method!=='POST'||req.headers.origin!=='http://127.0.0.1:14173'||req.headers.host!=='127.0.0.1:14173'){
    res.writeHead(403).end();return;
  }
  try{
    let body='';for await(const chunk of req){body+=chunk;if(body.length>256)throw Error('Invalid body')}
    const address=getAddress(JSON.parse(body).address);
    const {admin,round,dollar,end}=setup;
    const grant=async()=>{
      if(await round.eligibleUntil(address)>0n)return;
      await(await admin.sendTransaction({to:address,value:parseEther('0.02')})).wait();
      await(await dollar.faucet()).wait();await(await dollar.transfer(address,100000000)).wait();
      await(await round.attest(address,end)).wait();
    };
    const result=queue.then(grant);queue=result.catch(()=>{});await result;res.writeHead(204).end();
  }catch{res.writeHead(400).end('Could not prepare this test wallet')}
}
