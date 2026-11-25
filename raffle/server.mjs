import {enroll} from './local-enroll.mjs';
import http from 'node:http';
import fs from 'node:fs';
const artifact=JSON.parse(fs.readFileSync('HouseRaffle.json'));
const routes={
  '/how-it-works':['text/html','public/how-it-works.html'],
  '/':['text/html','public/index.html'],'/wallet.js':['text/javascript','public/wallet.js'],'/ethers.js':['text/javascript','node_modules/ethers/dist/ethers.min.js']
};
http.createServer((req,res)=>{
  if(req.url==='/local-enroll'){void enroll(req,res);return}
  if(req.url==='/abi.json'||req.url==='/round.json'){
    res.setHeader('Content-Type','application/json');res.end(req.url==='/abi.json'?JSON.stringify(artifact.abi):process.env.LOCAL_ROUND?process.env.LOCAL_ROUND:fs.existsSync('public/round.json')?fs.readFileSync('public/round.json'):'{}');return;
  }
  const route=routes[req.url];if(!route){res.writeHead(404).end();return}
  res.setHeader('Content-Type',route[0]);res.end(fs.readFileSync(route[1]));
}).listen(Number(process.env.PORT||14173),'127.0.0.1');
