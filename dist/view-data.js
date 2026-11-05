/** Display-only helpers; never change the full-payload BER calculation. */
export function constellationSelection(result,limit=1200){
  if(!result||!result.symbols)return{indices:[],errorSymbols:new Set(),baseCount:0,extraErrors:0};
  const count=Math.min(limit,result.symbols),selected=new Set();
  for(let j=0;j<count;j++)selected.add(Math.floor(j*result.symbols/count));
  const k=result.config.mode==='QPSK'?2:1,errorSymbols=new Set();
  for(const bit of result.errorIndices){const symbol=Math.floor(bit/k);if(symbol>=0&&symbol<result.symbols)errorSymbols.add(symbol);}
  const baseCount=selected.size;for(const symbol of errorSymbols)selected.add(symbol);
  return{indices:Array.from(selected).sort((a,b)=>a-b),errorSymbols,baseCount,extraErrors:selected.size-baseCount};
}
export function zeroErrorExplanation(result){
  if(!result||result.errors||!result.config.noise)return '';
  return `本次 ${result.bits.length.toLocaleString('en-US')} 位没有发现错误，但不代表真实误码率为零。单侧 95% 上界为 ${result.interval.high.toExponential(2)}；增加样本量可以进一步缩小上界。`;
}
