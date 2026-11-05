import { VERSION, simulateTransmission, validateSweep } from './core.js';
import { constellation, sequence, berChart } from './charts.js';
import { constellationSelection, zeroErrorExplanation } from './view-data.js';
const $=id=>document.getElementById(id);
const state={mode:'QPSK',result:null,rows:[],sweepConfig:null,running:false,worker:null,lastSweep:null};
const sci=x=>x===0?'0':x.toExponential(2),number=x=>x.toLocaleString('en-US');let toastTimer,resizeFrame;
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),Math.max(5000,Math.min(12000,Array.from(message).length*130)));}
function download(content,name,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function readConfig(){return{mode:state.mode,input:$('input-mode').value,text:$('message').value,bitCount:Number($('bit-count').value),noise:$('noise-toggle').checked,ebn0:Number($('ebn0').value),seed:Number($('seed').value)};}
function markStale(){if(state.result)$('stale-note').hidden=false;}
function syncControls(){const noise=$('noise-toggle').checked,ebn0=Number($('ebn0').value);$('ebn0-value').innerHTML=`${ebn0.toFixed(1)} <small>dB</small>`;$('ebn0').disabled=!noise;document.querySelectorAll('[data-snr]').forEach(button=>button.classList.toggle('selected',noise&&Number(button.dataset.snr)===ebn0));$('noiseless').classList.toggle('selected',!noise);const random=$('input-mode').value==='random';$('random-field').hidden=!random;$('message').hidden=random;document.querySelectorAll('[data-mode]').forEach(button=>{const selected=button.dataset.mode===state.mode;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});$('mapping-note').textContent=state.mode==='QPSK'?'Gray 映射 · 单位符号能量':'二相相干判决 · 单位符号能量';}
function drawCharts(){constellation($('constellation'),state.result);sequence($('sequence'),state.result);berChart($('ber-chart'),state.rows,state.sweepConfig);}
function renderTransmission(result){
  state.result=result;$('stale-note').hidden=true;
  $('metric-bits').textContent=number(result.bits.length);$('metric-symbols').textContent=`${number(result.symbols)} symbols`;
  $('metric-errors').textContent=number(result.errors);$('metric-error-note').textContent=result.errors?'已标记错误位置':'本样本未观察到错误';$('metric-ber').textContent=sci(result.ber);$('metric-theory').textContent=`理论值 ${sci(result.theory)}`;
  $('metric-status').textContent=result.errors?'出现误码':'完整恢复';$('metric-status').classList.toggle('has-error',result.errors>0);$('metric-seed').textContent=`随机种子 ${result.config.seed}`;
  $('chain-bits').textContent=`${number(result.bits.length)} bits`;$('chain-mode').textContent=`${result.config.mode} 调制`;$('chain-noise').textContent=result.config.noise?`Eᵦ/N₀ = ${result.config.ebn0} dB`:'无噪声对照';
  const selection=constellationSelection(result);
  $('constellation-count').textContent=result.symbols>1200?`显示 ${number(selection.indices.length)} / ${number(result.symbols)} 个符号，包含全部错误符号`:`${number(result.symbols)} 个符号 · 全量显示`;
  const explanation=zeroErrorExplanation(result);$('zero-error-note').textContent=explanation;$('zero-error-note').hidden=!explanation;
  const text=result.config.input==='text';$('sent-message').textContent=text?result.config.text:Array.from(result.bits.slice(0,96)).join('')+(result.bits.length>96?'…':'');$('received-message').textContent=text?result.decoded.text:Array.from(result.received.slice(0,96)).join('')+(result.received.length>96?'…':'');
  $('message-status').textContent=!text?'随机序列':!result.decoded.valid?'UTF-8 解码含无效字节':result.errors?'消息发生变化':'消息完整';
  const n=Math.min(128,result.bits.length);$('bit-summary').textContent=`前 ${n} / ${result.bits.length} 位 · 从 0 计数`;
  for(const side of ['tx','rx']){const container=$(`${side}-bits`);container.replaceChildren();for(let i=0;i<n;i++){const span=document.createElement('span');span.textContent=String((side==='tx'?result.bits:result.received)[i]);span.title=`bit ${i}`;if(result.bits[i]!==result.received[i])span.classList.add('bad');container.append(span);}}
  drawCharts();
}
function transmit(){try{renderTransmission(simulateTransmission(readConfig()));}catch(error){toast(error.message);}}
function renderRows(){
  $('results-table-wrap').hidden=!state.rows.length;$('export-csv').disabled=!state.rows.length;
  const fragment=document.createDocumentFragment();for(const row of state.rows){const tr=document.createElement('tr');for(const value of [row.mode,`${row.ebn0} dB`,number(row.bits),number(row.errors),row.errors?sci(row.ber):`未发现错误；上界 ${sci(row.high)}`,row.stoppedBy==='target-errors'?'目标错误数':'比特上限']){const td=document.createElement('td');td.textContent=value;tr.append(td);}fragment.append(tr);}$('results-table').replaceChildren(fragment);berChart($('ber-chart'),state.rows,state.sweepConfig);
}
function setRunning(running){state.running=running;$('run-sweep').hidden=running;$('stop-sweep').hidden=!running;for(const id of ['sweep-min','sweep-max','sweep-step','sweep-budget'])$(id).disabled=running;const config=state.sweepConfig;$('scan-context').hidden=!config;if(config)$('scan-context').textContent=`本次扫描：${config.min}～${config.max} dB，步长 ${config.step} dB，种子 ${config.seed}。扫描与上方单次实验分别运行，修改上方参数不会改变本次扫描。`;}
function startSweep(){
  if(state.running)return;
  const config={min:Number($('sweep-min').value),max:Number($('sweep-max').value),step:Number($('sweep-step').value),maxBits:Number($('sweep-budget').value),targetErrors:200,seed:Number($('seed').value)};
  try{validateSweep(config);}catch(error){toast(error.message);return;}
  state.rows=[];state.sweepConfig=config;state.lastSweep={config,status:'running'};renderRows();setRunning(true);$('sweep-progress').hidden=false;$('scan-progress').value=0;
  $('sweep-status').textContent='正在启动计算…';let worker;
  try{worker=new Worker('./worker.js',{type:'module'});}catch{setRunning(false);state.lastSweep.status='failed';$('sweep-status').textContent='无法创建分析 Worker';toast('无法启动计算；请使用 HTTP 启动方式，或尝试单文件版');return;}
  state.worker=worker;
  worker.onmessage=({data})=>{
    if(state.worker!==worker)return;
    if(data.type==='progress'){
      state.rows=data.rows;$('scan-progress').max=data.total;$('scan-progress').value=data.completed;
      $('sweep-status').textContent=`${data.completed} / ${data.total} 点 · ${data.mode} ${data.ebn0} dB · ${number(data.bits)} bits · ${data.errors} errors`;
      renderRows();
    }else if(data.type==='complete'){
      state.rows=data.rows;state.lastSweep={config,status:'completed'};state.worker=null;worker.terminate();setRunning(false);renderRows();$('scan-progress').value=$('scan-progress').max;
      $('sweep-status').textContent=`扫描完成 · ${data.rows.length} 个实验点 · 种子 ${config.seed}`;toast('扫描完成，可以导出包含区间与停止条件的 CSV');
    }else if(data.type==='error'){worker.terminate();state.worker=null;setRunning(false);state.lastSweep.status='failed';$('sweep-status').textContent='扫描失败';toast(data.message);}
  };
  worker.onerror=()=>{worker.terminate();state.worker=null;setRunning(false);state.lastSweep.status='failed';$('sweep-status').textContent='分析 Worker 无法加载';toast('计算线程加载失败，请按 README 使用本地 HTTP 方式启动');};
  worker.postMessage({type:'sweep',config});
}
function stopSweep(){if(!state.running)return;state.worker?.terminate();state.worker=null;setRunning(false);state.lastSweep.status='cancelled';$('sweep-status').textContent=`已停止 · 保留 ${state.rows.length} 个完整实验点`;toast('扫描已停止，已完成的点可以导出');}
function exportCsv(){
  if(!state.rows.length)return;const config=state.sweepConfig;
  const keys=['mode','ebn0','seed','bits','errors','ber','theory','low','high','method','stoppedBy','elapsedMs'];
  const lines=[keys.concat(['maxBits','targetErrors','baseSeed','scanStatus','version']).join(',')];
  for(const row of state.rows)lines.push(keys.map(key=>row[key]).concat([config.maxBits,config.targetErrors,config.seed,state.lastSweep.status,VERSION]).join(','));
  download(lines.join('\r\n'),'commscope-ber-results.csv','text/csv;charset=utf-8');
}
function exportSession(){const result=state.result;const session={application:'commscope-lab',version:VERSION,model:'unit-energy coherent uncoded symbol-level AWGN',transmission:result?{config:result.config,bits:result.bits.length,symbols:result.symbols,padding:result.padding,errors:result.errors,errorIndices:result.errorIndices,ber:result.ber,theory:result.theory,interval:result.interval,sigma:result.sigma,noiseMean:result.noiseMean,noiseVariance:result.noiseVariance}:null,sweep:state.lastSweep?{...state.lastSweep,rows:state.rows}:null};download(JSON.stringify(session,null,2),'commscope-experiment.json','application/json');toast('实验参数与结果已保存为 JSON');}
$('transmit-form').onsubmit=e=>{e.preventDefault();transmit();};
document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{state.mode=button.dataset.mode;syncControls();markStale();});
for(const id of ['input-mode','ebn0','noise-toggle'])$(id).oninput=()=>{syncControls();markStale();};
for(const id of ['message','bit-count','seed'])$(id).oninput=markStale;
document.querySelectorAll('[data-snr]').forEach(button=>button.onclick=()=>{$('ebn0').value=button.dataset.snr;$('noise-toggle').checked=true;syncControls();markStale();});
$('noiseless').onclick=()=>{$('noise-toggle').checked=false;syncControls();markStale();};
$('new-seed').onclick=()=>{const a=new Uint32Array(1);crypto.getRandomValues(a);$('seed').value=a[0];markStale();};
$('run-sweep').onclick=startSweep;$('stop-sweep').onclick=stopSweep;$('export-csv').onclick=exportCsv;$('export-session').onclick=exportSession;
$('open-guide').onclick=()=>$('guide').showModal();$('close-guide').onclick=()=>$('guide').close();$('guide-done').onclick=()=>$('guide').close();
window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(drawCharts);});
syncControls();transmit();
