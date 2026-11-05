import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PortableRunner} from '../scripts/portable-runner.js';
import {runTrial} from '../dist/core.js';

test('portable runner matches core results without using Worker',async()=>{
  const config={min:0,max:4,step:2,maxBits:10000,targetErrors:200,seed:2026};
  const runner=new PortableRunner();let complete;
  runner.onmessage=({data})=>{if(data.type==='complete')complete=data;};
  await runner.run({config});assert.equal(complete.rows.length,6);
  for(const row of complete.rows){const expected=runTrial(row.mode,row.ebn0,config);for(const key of ['bits','errors','ber','seed','theory','low','high'])assert.equal(row[key],expected[key]);}
});
test('portable calculation can be cancelled before its first chunk',async()=>{
  const runner=new PortableRunner();let messages=0;runner.onmessage=()=>messages++;
  const pending=runner.run({config:{min:8,max:8,step:1,maxBits:2000000,targetErrors:200,seed:2026}});
  runner.terminate();await pending;assert.equal(messages,0);
});
test('single HTML parses as classic JavaScript and has no external startup dependencies',()=>{
  const html=fs.readFileSync(new URL('../CommScope-Lab.html',import.meta.url),'utf8');
  assert.ok(!/<script[^>]+src=/.test(html));assert.ok(!/rel="stylesheet"/.test(html));
  const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];new vm.Script(code);
  assert.ok(!/new Worker\(/.test(code));assert.ok(!/\bfetch\(/.test(code));
  assert.ok(/new PortableRunner\(\)/.test(code));
});
