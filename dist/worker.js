import { simulateTransmission, validateSweep, pointSeed, createTrial, advanceTrial, trialResult } from './core.js';
let active=0;
const yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0));
self.onmessage=async({data})=>{
  const id=++active;
  try{
    if(data.type==='transmit'){self.postMessage({type:'transmission',result:simulateTransmission(data.config)});return;}
    const config=data.config,points=validateSweep(config),rows=[],total=points.length*2;
    for(const ebn0 of points)for(const mode of ['BPSK','QPSK']){
      const trial=createTrial(mode,ebn0,pointSeed(config.seed,mode,ebn0)),start=performance.now();
      while(trial.bits<config.maxBits&&trial.errors<config.targetErrors){
        if(id!==active)return;
        advanceTrial(trial,Math.min(10000,config.maxBits-trial.bits));
        self.postMessage({type:'progress',completed:rows.length,total,mode,ebn0,bits:trial.bits,errors:trial.errors,rows});
        await yieldTask();
      }
      rows.push(trialResult(trial,config,Math.round(performance.now()-start)));
      self.postMessage({type:'progress',completed:rows.length,total,mode,ebn0,bits:trial.bits,errors:trial.errors,rows});
    }
    self.postMessage({type:'complete',rows,config});
  }catch(error){self.postMessage({type:'error',message:error.message});}
};
