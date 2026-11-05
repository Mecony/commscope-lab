import test from 'node:test';
import assert from 'node:assert/strict';
import {constellationSelection,zeroErrorExplanation} from '../dist/view-data.js';
import {simulateTransmission} from '../dist/core.js';

test('rare errors omitted by uniform sampling are still selected',()=>{
  const result={symbols:2401,config:{mode:'BPSK'},errorIndices:[1,2400]};
  const selected=constellationSelection(result);
  assert.ok(selected.indices.includes(1)&&selected.indices.includes(2400));
  assert.equal(selected.baseCount,1200);assert.equal(selected.extraErrors,2);
});
test('QPSK maps bit errors to symbols and deduplicates two errors in one symbol',()=>{
  const result={symbols:2401,config:{mode:'QPSK'},errorIndices:[2,3,4800]};
  const selected=constellationSelection(result);
  assert.deepEqual(Array.from(selected.errorSymbols),[1,2400]);
  assert.equal(selected.indices.filter(i=>i===1).length,1);assert.equal(selected.extraErrors,2);
});
test('small constellations are complete and selection never mutates error indices',()=>{
  const errors=Object.freeze([1,3]),result={symbols:4,config:{mode:'BPSK'},errorIndices:errors};
  assert.deepEqual(constellationSelection(result).indices,[0,1,2,3]);
  assert.deepEqual(errors,[1,3]);assert.deepEqual(constellationSelection(null).indices,[]);
});
test('zero-error text explains a nonzero bound without changing transmission data',()=>{
  const result=simulateTransmission({mode:'QPSK',input:'text',text:'Hello',noise:true,ebn0:14,seed:2026,bitCount:1024});
  assert.equal(result.errors,0);const text=zeroErrorExplanation(result);
  assert.ok(text.includes('不代表真实误码率为零')&&text.includes('95%')&&text.includes(result.interval.high.toExponential(2)));
  assert.equal(zeroErrorExplanation({...result,errors:1}),'');
  assert.equal(zeroErrorExplanation({...result,config:{noise:false}}),'');
});
