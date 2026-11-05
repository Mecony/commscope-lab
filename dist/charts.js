import { theoreticalBer } from './core.js';
import { constellationSelection } from './view-data.js';
const C={grid:'#edf1f6',axis:'#ced8e6',text:'#9aa9bd',blue:'#527fe8',orange:'#dfa468',red:'#d96577',theory:'#95a4ba'};
function prepare(canvas){const r=canvas.getBoundingClientRect(),w=Math.max(200,r.width),h=Math.max(120,r.height),d=Math.min(window.devicePixelRatio||1,2);if(canvas.width!==Math.round(w*d)||canvas.height!==Math.round(h*d)){canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);}const c=canvas.getContext('2d');c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,w,h);c.font='9px ui-monospace,monospace';c.lineWidth=1;return{c,w,h};}
function line(c,x0,y0,x1,y1,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x0,y0);c.lineTo(x1,y1);c.stroke();}
function circle(c,x,y,r,color,fill=true){c.beginPath();c.arc(x,y,r,0,Math.PI*2);if(fill){c.fillStyle=color;c.fill();}else{c.strokeStyle=color;c.lineWidth=1.5;c.stroke();}}
export function constellation(canvas,result){const{c,w,h}=prepare(canvas),pad={l:39,r:24,t:18,b:30},side=Math.min(w-pad.l-pad.r,h-pad.t-pad.b),cx=(w+pad.l-pad.r)/2,cy=(h+pad.t-pad.b)/2;
  const selection=constellationSelection(result);let bound=2;
  for(const i of selection.indices)bound=Math.max(bound,Math.abs(result.rxI[i]),Math.abs(result.rxQ[i]));bound=Math.ceil(bound*1.08*2)/2;
  const scale=side/(2*bound),x=v=>cx+v*scale,y=v=>cy-v*scale;
  for(let n=-2;n<=2;n++){const v=n*bound/2;line(c,x(-bound),y(v),x(bound),y(v),n===0?C.axis:C.grid);line(c,x(v),y(-bound),x(v),y(bound),n===0?C.axis:C.grid);if(n!==0){c.fillStyle=C.text;c.textAlign='center';c.fillText(v.toFixed(1),x(v),y(-bound)+16);c.textAlign='right';c.fillText(v.toFixed(1),x(-bound)-8,y(v)+3);}}
  c.fillStyle=C.text;c.textAlign='left';c.fillText('Q',x(.06),y(bound)+5);c.fillText('I',x(bound)+8,y(0)+3);
  if(!result)return;
  const k=result.config.mode==='QPSK'?2:1;
  for(const bad of [false,true])for(const i of selection.indices){if(selection.errorSymbols.has(i)!==bad)continue;c.globalAlpha=bad?.85:.38;circle(c,x(result.rxI[i]),y(result.rxQ[i]),bad?3:2.3,bad?C.red:C.orange);}c.globalAlpha=1;
  const a=1/Math.sqrt(k),points=k===1?[[a,0,'0'],[-a,0,'1']]:[[a,a,'00'],[-a,a,'10'],[-a,-a,'11'],[a,-a,'01']];
  for(const[i,q,label]of points){const px=x(i),py=y(q);circle(c,px,py,6,'#fff');line(c,px-4,py,px+4,py,C.blue,1.6);line(c,px,py-4,px,py+4,C.blue,1.6);c.fillStyle=C.blue;c.textAlign='center';c.fillText(label,px,py-11);}
}
export function sequence(canvas,result){const{c,w,h}=prepare(canvas),l=40,r=20,t=26,b=31,n=result?Math.min(24,result.symbols):24;let bound=1.6;
  if(result)for(let i=0;i<n;i++)bound=Math.max(bound,Math.abs(result.rxI[i])*1.13);bound=Math.ceil(bound*2)/2;
  const x=i=>l+i*(w-l-r)/Math.max(1,n-1),y=v=>t+(bound-v)/(2*bound)*(h-t-b);
  for(let j=-2;j<=2;j++){const v=j*bound/2;line(c,l,y(v),w-r,y(v),j===0?C.axis:C.grid);c.fillStyle=C.text;c.textAlign='right';c.fillText(v.toFixed(1),l-9,y(v)+3);}
  for(let i=0;i<n;i+=Math.max(1,Math.floor(n/6))){c.fillStyle=C.text;c.textAlign='center';c.fillText(String(i+1),x(i),h-10);}
  if(!result)return;
  c.strokeStyle=C.blue;c.lineWidth=1.3;c.beginPath();for(let i=0;i<n;i++){if(i===0)c.moveTo(x(i),y(result.txI[i]));else{c.lineTo(x(i),y(result.txI[i-1]));c.lineTo(x(i),y(result.txI[i]));}}c.stroke();
  const k=result.config.mode==='QPSK'?2:1;
  for(let i=0;i<n;i++){const bad=result.bits[i*k]!==result.received[i*k];line(c,x(i),y(result.txI[i]),x(i),y(result.rxI[i]),'#e2cbb18c');circle(c,x(i),y(result.rxI[i]),2.8,bad?C.red:C.orange);}
}
export function berChart(canvas,rows,config){const{c,w,h}=prepare(canvas),l=56,r=27,t=25,b=37,xMin=config?.min??0,xMax=config?.max??8;
  const minTheory=theoreticalBer(xMax),maxExponent=Math.max(3,Math.min(18,Math.ceil(-Math.log10(minTheory))+1)),tick=Math.max(1,Math.ceil(maxExponent/6)),bottom=Math.ceil(maxExponent/tick)*tick;
  const x=v=>l+(v-xMin)/(xMax-xMin||1)*(w-l-r),y=v=>t+(-Math.log10(Math.max(10**(-bottom),Math.min(1,v))))/bottom*(h-t-b);
  for(let exp=0;exp<=bottom;exp+=tick){const yy=y(10**(-exp));line(c,l,yy,w-r,yy,C.grid);c.fillStyle=C.text;c.textAlign='right';c.fillText(`10^${exp===0?'0':'−'+exp}`,l-10,yy+3);}
  const dx=Math.max(1,Math.ceil((xMax-xMin)/8));for(let value=xMin;value<=xMax;value+=dx){line(c,x(value),t,x(value),h-b,C.grid);c.fillStyle=C.text;c.textAlign='center';c.fillText(String(value),x(value),h-b+18);}
  c.textAlign='left';c.fillText('BER',l,t-10);c.textAlign='right';c.fillText('Eᵦ/N₀ (dB)',w-r,h-7);
  c.strokeStyle=C.theory;c.lineWidth=1.6;c.setLineDash([4,4]);c.beginPath();for(let i=0;i<=200;i++){const value=xMin+(xMax-xMin)*i/200,xx=x(value),yy=y(theoreticalBer(value));i?c.lineTo(xx,yy):c.moveTo(xx,yy);}c.stroke();c.setLineDash([]);
  for(const mode of ['BPSK','QPSK']){const data=rows.filter(row=>row.mode===mode).sort((a,b)=>a.ebn0-b.ebn0),color=mode==='BPSK'?C.blue:C.orange;c.strokeStyle=color;c.lineWidth=1.25;c.beginPath();data.forEach((row,i)=>{const yy=y(row.errors?row.ber:row.high);i?c.lineTo(x(row.ebn0),yy):c.moveTo(x(row.ebn0),yy);});c.stroke();
    for(const row of data){const xx=x(row.ebn0),yy=y(row.errors?row.ber:row.high);line(c,xx,y(row.low||row.high),xx,y(row.high),color,.8);line(c,xx-3,y(row.high),xx+3,y(row.high),color,.8);if(row.errors){line(c,xx-3,y(row.low),xx+3,y(row.low),color,.8);if(mode==='BPSK')circle(c,xx,yy,3.3,color);else{c.strokeStyle=color;c.lineWidth=1.7;c.strokeRect(xx-3,yy-3,6,6);}}else{c.fillStyle=color;c.beginPath();c.moveTo(xx-4,yy-3);c.lineTo(xx+4,yy-3);c.lineTo(xx,yy+4);c.closePath();c.fill();}}
  }
  if(!rows.length){c.fillStyle='#a5b2c5';c.textAlign='center';c.font='10px sans-serif';c.fillText('点击「开始扫描」，生成你的仿真实验点',l+(w-l-r)*.55,t+(h-t-b)*.28);}
}
