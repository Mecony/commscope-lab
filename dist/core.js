/** Symbol-level, coherent, uncoded AWGN model. Es = 1 for both modulations. */
export const VERSION = '0.1.0';
export function assertNumber(x,min,max,name,integer=false){if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max||(integer&&!Number.isInteger(x)))throw new Error(`${name}需在 ${min}～${max} 范围内${integer?'且为整数':''}`);return x;}
export function validateMode(mode){if(!['BPSK','QPSK'].includes(mode))throw new Error('请选择 BPSK 或 QPSK');return mode;}
export function uniform(seed){assertNumber(seed,0,4294967295,'随机种子',true);let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function normalGenerator(rng){let spare=null;return()=>{if(spare!==null){const x=spare;spare=null;return x;}const u=Math.max(Number.MIN_VALUE,rng()),v=rng(),r=Math.sqrt(-2*Math.log(u));spare=r*Math.sin(2*Math.PI*v);return r*Math.cos(2*Math.PI*v);};}
export function noiseSigma(mode,ebn0){validateMode(mode);assertNumber(ebn0,-4,14,'Eb/N₀');return Math.sqrt(1/(2*(mode==='QPSK'?2:1)*10**(ebn0/10)));}
/** Stable erfc approximation for nonnegative inputs; validated against SciPy fixtures. */
export function erfcPositive(x){const t=1/(1+x/2);return t*Math.exp(-x*x-1.26551223+t*(1.00002368+t*(.37409196+t*(.09678418+t*(-.18628806+t*(.27886807+t*(-1.13520398+t*(1.48851587+t*(-.82215223+t*.17087277)))))))));}
export function theoreticalBer(ebn0){assertNumber(ebn0,-4,14,'Eb/N₀');return .5*erfcPositive(Math.sqrt(10**(ebn0/10)));}
export function confidenceInterval(errors,bits){
  assertNumber(bits,1,20000000,'样本比特数',true);assertNumber(errors,0,bits,'错误数',true);
  if(errors===0)return{low:0,high:-Math.expm1(Math.log(.05)/bits),method:'one-sided-exact-95'};
  if(errors===bits)return{low:Math.exp(Math.log(.05)/bits),high:1,method:'one-sided-exact-95'};
  const z=1.959963984540054,p=errors/bits,d=1+z*z/bits,c=(p+z*z/(2*bits))/d;
  const half=z*Math.sqrt(p*(1-p)/bits+z*z/(4*bits*bits))/d;
  return{low:Math.max(0,c-half),high:Math.min(1,c+half),method:'wilson-approx-95'};
}
export function bitsFromText(text){if(typeof text!=='string'||!text.length)throw new Error('请输入要发送的文字');const bytes=new TextEncoder().encode(text);if(bytes.length>1024)throw new Error('文字 UTF-8 编码后不能超过 1024 字节');const bits=new Uint8Array(bytes.length*8);bytes.forEach((b,i)=>{for(let j=0;j<8;j++)bits[i*8+j]=(b>>(7-j))&1;});return bits;}
export function textFromBits(bits){const bytes=new Uint8Array(Math.floor(bits.length/8));for(let i=0;i<bytes.length;i++)for(let j=0;j<8;j++)bytes[i]=(bytes[i]<<1)|bits[i*8+j];let valid=true;try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{valid=false;}return{text:new TextDecoder().decode(bytes),valid};}
export function mapBits(bits,mode){validateMode(mode);if(!bits.length||bits.some(b=>b!==0&&b!==1))throw new Error('比特序列应仅包含 0 和 1');const k=mode==='QPSK'?2:1,n=Math.ceil(bits.length/k),i=new Float64Array(n),q=new Float64Array(n),a=1/Math.sqrt(k);for(let s=0;s<n;s++){i[s]=(1-2*bits[s*k])*a;q[s]=k===2?(1-2*(bits[s*k+1]??0))*a:0;}return{i,q,k,padding:n*k-bits.length};}
export function demapSymbols(i,q,mode,length){const k=mode==='QPSK'?2:1,bits=new Uint8Array(length??i.length*k);for(let s=0;s<i.length;s++){if(s*k<bits.length)bits[s*k]=i[s]<0?1:0;if(k===2&&s*k+1<bits.length)bits[s*k+1]=q[s]<0?1:0;}return bits;}
export function simulateTransmission(config){
  const mode=validateMode(config.mode),seed=assertNumber(config.seed,0,4294967295,'随机种子',true),ebn0=assertNumber(config.ebn0,-4,14,'Eb/N₀');
  if(typeof config.noise!=='boolean'||!['text','random'].includes(config.input))throw new Error('无效的实验配置');
  const rng=uniform(seed);let bits;
  if(config.input==='text')bits=bitsFromText(config.text);else{assertNumber(config.bitCount,8,8192,'比特数量',true);bits=Uint8Array.from({length:config.bitCount},()=>rng()<.5?0:1);}
  const tx=mapBits(bits,mode),normal=normalGenerator(rng),sigma=config.noise?noiseSigma(mode,ebn0):0;
  const ri=new Float64Array(tx.i.length),rq=new Float64Array(tx.i.length);let sum=0,sumSq=0;
  for(let s=0;s<ri.length;s++){const ni=sigma*normal(),nq=sigma*normal();ri[s]=tx.i[s]+ni;rq[s]=tx.q[s]+nq;sum+=ni+nq;sumSq+=ni*ni+nq*nq;}
  const received=demapSymbols(ri,rq,mode,bits.length),errorIndices=[];for(let b=0;b<bits.length;b++)if(bits[b]!==received[b])errorIndices.push(b);
  const decoded=config.input==='text'?textFromBits(received):null,mean=sum/(ri.length*2),variance=sumSq/(ri.length*2)-mean*mean;
  return{version:VERSION,config:{...config},bits,received,txI:tx.i,txQ:tx.q,rxI:ri,rxQ:rq,padding:tx.padding,symbols:ri.length,errors:errorIndices.length,errorIndices,ber:errorIndices.length/bits.length,theory:config.noise?theoreticalBer(ebn0):0,interval:confidenceInterval(errorIndices.length,bits.length),decoded,sigma,noiseMean:mean,noiseVariance:variance};
}
export function validateSweep(config){
  assertNumber(config.min,-4,12,'起始 Eb/N₀',true);assertNumber(config.max,config.min,14,'结束 Eb/N₀',true);assertNumber(config.step,1,4,'扫描步长',true);
  assertNumber(config.maxBits,10000,2000000,'最大比特数',true);assertNumber(config.targetErrors,20,5000,'目标错误数',true);assertNumber(config.seed,0,4294967295,'随机种子',true);
  if((config.max-config.min)%config.step!==0||(config.max-config.min)/config.step>18)throw new Error('扫描范围应能被步长整除，最多 19 个点');
  if(config.maxBits%2)throw new Error('扫描最大比特数应为偶数');
  const points=[];for(let x=config.min;x<=config.max;x+=config.step)points.push(x);return points;
}
export function pointSeed(seed,mode,ebn0){return (seed^Math.imul(ebn0+128,0x9e3779b1)^(mode==='BPSK'?0x12345678:0x87654321))>>>0;}
/** Stateful chunks allow progress/cancellation between batches in the worker. */
export function createTrial(mode,ebn0,seed){validateMode(mode);return{mode,ebn0,seed,rng:uniform(seed),normal:null,bits:0,errors:0};}
export function advanceTrial(trial,count){
  const k=trial.mode==='QPSK'?2:1,sigma=noiseSigma(trial.mode,trial.ebn0),a=1/Math.sqrt(k);
  if(!trial.normal)trial.normal=normalGenerator(trial.rng);
  for(let n=0;n<count;n+=k){const b0=trial.rng()<.5?0:1,b1=k===2?(trial.rng()<.5?0:1):0;
    const i=(1-2*b0)*a+sigma*trial.normal(),q=(k===2?(1-2*b1)*a:0)+sigma*trial.normal();
    trial.errors+=Number((i<0?1:0)!==b0);if(k===2)trial.errors+=Number((q<0?1:0)!==b1);trial.bits+=k;}
}
export function trialResult(trial,config,elapsedMs=0){const interval=confidenceInterval(trial.errors,trial.bits);return{mode:trial.mode,ebn0:trial.ebn0,seed:trial.seed,bits:trial.bits,errors:trial.errors,ber:trial.errors/trial.bits,theory:theoreticalBer(trial.ebn0),...interval,stoppedBy:trial.errors>=config.targetErrors?'target-errors':'max-bits',elapsedMs};}
export function runTrial(mode,ebn0,config){const seed=pointSeed(config.seed,mode,ebn0),trial=createTrial(mode,ebn0,seed);while(trial.bits<config.maxBits&&trial.errors<config.targetErrors)advanceTrial(trial,Math.min(10000,config.maxBits-trial.bits));return trialResult(trial,config);}
