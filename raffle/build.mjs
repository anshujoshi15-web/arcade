import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import solc from 'solc';
export function compile(files) {
  const sources = Object.fromEntries(files.map(file=>[file,{content:fs.readFileSync(file,'utf8')}]));
  const input={language:'Solidity',sources,settings:{optimizer:{enabled:true,runs:200},evmVersion:'cancun',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}};
  const output=JSON.parse(solc.compile(JSON.stringify(input),{import:path=>({contents:fs.readFileSync(path.startsWith('contracts/')?path:'node_modules/'+path,'utf8')})}));
  for(const issue of output.errors??[]) if(issue.severity==='error')throw Error(issue.formattedMessage);
  return output.contracts;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
const name='contracts/HouseRaffle.sol';
fs.writeFileSync('HouseRaffle.json',JSON.stringify(compile([name])[name].HouseRaffle));
}
