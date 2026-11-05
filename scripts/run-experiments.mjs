import fs from 'node:fs';
import {runTrial,validateSweep,VERSION} from '../dist/core.js';
const config={min:0,max:8,step:2,maxBits:500000,targetErrors:200,seed:2026};
const rows=[];for(const x of validateSweep(config))for(const mode of ['BPSK','QPSK'])rows.push(runTrial(mode,x,config));
const destination=new URL('../docs/example-results.json',import.meta.url);
fs.writeFileSync(destination,JSON.stringify({version:VERSION,config,rows},null,2)+'\n');
const columns=['mode','ebn0','seed','bits','errors','ber','theory','low','high','method','stoppedBy'];
fs.writeFileSync(new URL('../docs/example-results.csv',import.meta.url),[columns.join(','),...rows.map(row=>columns.map(key=>row[key]).join(','))].join('\n')+'\n');
console.log(JSON.stringify(rows.map(row=>({mode:row.mode,ebn0:row.ebn0,bits:row.bits,errors:row.errors,ber:row.ber,theory:row.theory})),null,2));
