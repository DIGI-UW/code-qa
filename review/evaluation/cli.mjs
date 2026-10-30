#!/usr/bin/env node
import {parseArgs} from 'node:util';import {readFile,writeFile} from 'node:fs/promises';
import {freezeEvaluation,runEvaluation,scoreEvaluation} from './index.mjs';
const {values:v,positionals:p}=parseArgs({allowPositionals:true,options:Object.fromEntries(['corpus','labels','settings','freeze','out','split','evaluation','adjudication'].map(k=>[k,{type:'string'}]))});
const read=async key=>{if(!v[key])throw new Error('Missing --'+key);return JSON.parse(await readFile(v[key],'utf8'));};
try {
 let result;
 if(p[0]==='freeze')result=freezeEvaluation(await read('corpus'),await read('labels'),await read('settings'));
 else if(p[0]==='run'){const controller=new AbortController();for(const sig of ['SIGINT','SIGTERM'])process.once(sig,()=>controller.abort());await runEvaluation(await read('freeze'),await read('corpus'),await read('labels'),v.out,{split:v.split,signal:controller.signal});console.log('Evaluation retained; independent adjudication required');process.exit(0);}
 else if(p[0]==='score')result=scoreEvaluation(await read('evaluation'),await read('labels'),await read('adjudication'));
 else throw new Error('Use freeze, run or score; see evaluation guide');
 if(!v.out)throw new Error('Missing --out');await writeFile(v.out,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
} catch(error){console.error(error.message);process.exitCode=2;}
