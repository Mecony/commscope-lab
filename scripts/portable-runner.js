import { validateSweep, pointSeed, createTrial, advanceTrial, trialResult } from '../dist/core.js';

/** Cooperative runner for the single-file build: no Worker, fetch or server. */
export class PortableRunner {
  constructor(){this.cancelled=false;this.onmessage=null;}
  terminate(){this.cancelled=true;}
  postMessage(data){this.run(data).catch(error=>{if(!this.cancelled)this.onmessage?.({data:{type:'error',message:error.message}});});}
  emit(data){if(!this.cancelled)this.onmessage?.({data});}
  async run(data){
    const config=data.config,points=validateSweep(config),rows=[],total=points.length*2;
    for(const ebn0 of points)for(const mode of ['BPSK','QPSK']){
      const trial=createTrial(mode,ebn0,pointSeed(config.seed,mode,ebn0)),start=performance.now();
      while(trial.bits<config.maxBits&&trial.errors<config.targetErrors){
        await new Promise(resolve=>setTimeout(resolve,0));
        if(this.cancelled)return;
        advanceTrial(trial,Math.min(10000,config.maxBits-trial.bits));
        this.emit({type:'progress',completed:rows.length,total,mode,ebn0,bits:trial.bits,errors:trial.errors,rows:rows.map(row=>({...row}))});
      }
      rows.push(trialResult(trial,config,Math.round(performance.now()-start)));
      this.emit({type:'progress',completed:rows.length,total,mode,ebn0,bits:trial.bits,errors:trial.errors,rows:rows.map(row=>({...row}))});
    }
    this.emit({type:'complete',rows,config});
  }
}
