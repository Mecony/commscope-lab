import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { uniform,normalGenerator,noiseSigma,theoreticalBer,confidenceInterval,bitsFromText,textFromBits,mapBits,demapSymbols,simulateTransmission,validateSweep,runTrial,createTrial,advanceTrial,pointSeed } from '../dist/core.js';
const config={mode:'QPSK',input:'text',text:'Hello，通信 👋',bitCount:1024,noise:true,ebn0:4,seed:2026};

test('UTF-8 Chinese and emoji roundtrip at the bit level',()=>{const bits=bitsFromText(config.text);const decoded=textFromBits(bits);assert.equal(decoded.text,config.text);assert.equal(decoded.valid,true);assert.equal(bits.length,new TextEncoder().encode(config.text).length*8);});
test('both mappings have unit symbol energy and QPSK has Gray neighbours',()=>{
  for(const mode of ['BPSK','QPSK']){const tx=mapBits(Uint8Array.of(0,0,1,0,1,1,0,1),mode);for(let s=0;s<tx.i.length;s++)assert.ok(Math.abs(tx.i[s]**2+tx.q[s]**2-1)<1e-12);}
  const words=[[0,0],[1,0],[1,1],[0,1]];for(let n=0;n<4;n++)assert.equal(words[n].filter((b,i)=>b!==words[(n+1)%4][i]).length,1);
});
test('odd-length QPSK padding is removed and never counted in received payload',()=>{const bits=Uint8Array.of(1,0,1,1,0);const tx=mapBits(bits,'QPSK');assert.equal(tx.padding,1);assert.deepEqual(demapSymbols(tx.i,tx.q,'QPSK',bits.length),bits);});
test('noiseless transmission recovers text exactly for both modulations',()=>{for(const mode of ['BPSK','QPSK']){const r=simulateTransmission({...config,mode,noise:false});assert.equal(r.errors,0);assert.equal(r.decoded.text,config.text);assert.equal(r.noiseVariance,0);}});
test('same seed/config produces identical errors and received symbols',()=>{const a=simulateTransmission(config),b=simulateTransmission(config);assert.deepEqual(a,b);assert.equal(config.text,'Hello，通信 👋');});
test('Eb/N0 normalization accounts for bits per symbol',()=>{assert.equal(noiseSigma('BPSK',0)**2,.5000000000000001);assert.ok(Math.abs(noiseSigma('QPSK',0)**2-.25)<1e-12);assert.ok(Math.abs(noiseSigma('BPSK',4)/noiseSigma('QPSK',4)-Math.sqrt(2))<1e-12);});
test('Gaussian source has the expected mean, variance and 3-sigma tail',()=>{const normal=normalGenerator(uniform(123));let sum=0,squares=0,tail=0;const n=200000;for(let i=0;i<n;i++){const x=normal();sum+=x;squares+=x*x;if(Math.abs(x)>3)tail++;}assert.ok(Math.abs(sum/n)<.01);assert.ok(Math.abs(squares/n-1)<.015);assert.ok(Math.abs(tail/n-.0027)<.0005);});
test('empirical channel noise is consistent with configured variance',()=>{for(const mode of ['BPSK','QPSK']){const r=simulateTransmission({...config,mode,input:'random',bitCount:8192});assert.ok(Math.abs(r.noiseMean)<r.sigma*.04);assert.ok(Math.abs(r.noiseVariance/(r.sigma*r.sigma)-1)<.06);}});
test('JavaScript theoretical curve agrees with independent SciPy fixtures',()=>{const fixtures=JSON.parse(fs.readFileSync(new URL('./theory-fixtures.json',import.meta.url),'utf8'));for(const f of fixtures)assert.ok(Math.abs(theoreticalBer(f.ebn0)-f.ber)<f.ber*3e-6+1e-14);});
test('fixed-budget Monte Carlo matches theory for both modulations across Eb/N0',()=>{for(const mode of ['BPSK','QPSK'])for(const ebn0 of [0,4,8]){const r=runTrial(mode,ebn0,{seed:2026,maxBits:1000000,targetErrors:5000});assert.ok(Math.abs(r.ber-r.theory)<6*Math.sqrt(r.theory*(1-r.theory)/r.bits)+1/r.bits);}});
test('zero observed errors produces a nonzero exact one-sided bound',()=>{const c=confidenceInterval(0,100000);assert.equal(c.low,0);assert.ok(c.high>0);assert.ok(Math.abs((1-c.high)**100000-.05)<1e-10);assert.equal(c.method,'one-sided-exact-95');});
test('nonzero error Wilson intervals contain the sample proportion',()=>{for(const errors of [1,100,999]){const c=confidenceInterval(errors,1000);assert.ok(c.low<=errors/1000&&c.high>=errors/1000);}});
test('trial chunking preserves random sequence and aggregate result',()=>{const a=createTrial('QPSK',4,7),b=createTrial('QPSK',4,7);advanceTrial(a,10000);for(let n=0;n<10;n++)advanceTrial(b,1000);assert.equal(a.errors,b.errors);assert.equal(a.bits,b.bits);});
test('scan settings reject invalid or unbounded work before a worker starts',()=>{const c={min:0,max:8,step:2,maxBits:500000,targetErrors:200,seed:2026};assert.deepEqual(validateSweep(c),[0,2,4,6,8]);for(const delta of [{max:9},{maxBits:500001},{seed:-1},{step:0},{maxBits:Infinity},{targetErrors:1}])assert.throws(()=>validateSweep({...c,...delta}));});
test('point seeds distinguish modulation and SNR while remaining reproducible',()=>{assert.equal(pointSeed(2026,'QPSK',4),pointSeed(2026,'QPSK',4));assert.notEqual(pointSeed(2026,'QPSK',4),pointSeed(2026,'BPSK',4));assert.notEqual(pointSeed(2026,'BPSK',4),pointSeed(2026,'BPSK',6));});
test('malformed payloads and invalid channel settings are rejected',()=>{for(const delta of [{mode:'FM'},{input:'wrong'},{seed:NaN},{text:''},{text:'中'.repeat(400)},{noise:'false'},{ebn0:100}])assert.throws(()=>simulateTransmission({...config,...delta}));});
