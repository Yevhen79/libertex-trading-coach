/*
 * Libertex Trading Coach — live in-terminal overlay (v2.2 · EN)
 * ------------------------------------------------------------
 * English-language build of the behavioural coach that runs INSIDE the logged-in
 * Libertex web terminal. Polls the same closed-positions API the app uses,
 * reacts to every NEW closed trade with a leverage- & balance-aware comment,
 * and every 10 new trades produces a Guardian-Angel-style "AI Trading Review".
 *
 * HOW TO RUN: open https://app.libertex.org (desktop or /m), log in, open the
 * DevTools console, allow pasting, paste this whole file, Enter. A floating
 * orange "Trading Coach" widget appears. Hard reload removes it; paste again.
 *
 * DATA SOURCE: GET /spa/report/closed-positions?...  (same-origin, session cookies)
 *   P&L = equityInv - sumInv ; volume = sumInv * mult ; balance from .spare-cash
 */
(function(){
  var prev=window.__lbxCoach;
  try{ if(window.__lbxCoachStop) window.__lbxCoachStop(); }catch(e){}
  var API='/spa/report/closed-positions?page=1&pageSize=100&order=CloseTime&orderDir=desc&searchPhrase=';
  var C={bg:'#111111',sf:'#181818',rs:'#242526',br:'#FFA408',pos:'#53A642',neg:'#E64545',t:'#ffffff',t2:'#909294',line:'#2a2b2c',font:'Inter,Roboto,-apple-system,system-ui,Arial,sans-serif'};
  var S={seen:{},cards:[],idx:0,newCount:0,newTrades:[],baseAll:[],init:false,rot:{},bal:20000,medSum:0,medDur:0};
  if(prev&&prev.init){S.seen=prev.seen||{};S.cards=prev.cards||[];S.idx=prev.idx||0;S.newCount=prev.newCount||0;S.newTrades=prev.newTrades||[];S.baseAll=prev.baseAll||[];S.medSum=prev.medSum||0;S.medDur=prev.medDur||0;S.rot=prev.rot||{};S.bal=prev.bal||20000;S.init=true;}
  window.__lbxCoach=S;
  var pnl=function(t){return Math.round((t.equityInv-t.sumInv)*100)/100;};
  var win=function(t){return pnl(t)>0;},loss=function(t){return pnl(t)<0;};
  var sum=function(a){return a.reduce(function(s,v){return s+v;},0);};
  var fmt=function(n){return (Math.round(Math.abs(n)*100)/100).toLocaleString('en-US',{maximumFractionDigits:2});};
  var sgn=function(n){return (n>=0?'+':'−')+'$'+fmt(n);};
  var fk=function(n){return n>=1000?(Math.round(n/100)/10).toLocaleString('en-US')+'k':fmt(n);};
  var med=function(a){if(!a.length)return 0;var b=a.slice().sort(function(x,y){return x-y;});return b[Math.floor(b.length/2)];};
  var moveOf=function(t){return t.direction==='growth'?(t.closeRate-t.startRate)/t.startRate*100:(t.startRate-t.closeRate)/t.startRate*100;};
  var wipe=function(m){return m?100/m:100;};
  function readBal(){try{var el=document.querySelector('.spare-cash');if(el){var n=parseFloat((el.textContent||'').replace(/[^0-9.]/g,''));if(n>0)S.bal=n;}}catch(e){}return S.bal;}
  function rot(pool,key){var i=(S.rot[key]||0)%pool.length;S.rot[key]=(S.rot[key]||0)+1;return pool[i];}
  var LOSS=['Ah, <b>{a}</b> closed in the red at <b>{v}</b> — it happens to all of us.','This one didn’t go your way: <b>{a}</b> at <b>{v}</b>. Onwards. 🙂','A loss on <b>{a}</b> — <b>{v}</b>. Part of the game, let’s learn from it.','Not this time — <b>{a}</b> closed at <b>{v}</b>. Shake it off.','<b>{a}</b> ended in the red: <b>{v}</b>. What matters is your next move.'];
  var WIN=['Nice one — profit on <b>{a}</b>, <b>{v}</b>! 👍','Green trade: <b>{a}</b> closed at <b>{v}</b>. Well played. 🙂','You booked <b>{v}</b> on <b>{a}</b> — good work. ✅','That’s the way — <b>{a}</b> up <b>{v}</b>.','In the green on <b>{a}</b>: <b>{v}</b>. Keep it going.'];
  var magW=function(p){return p<0.5?'barely noticeable':p<1.5?'small':p<4?'noticeable':p<8?'significant':'large';};
  var magWW=function(p){return p<0.5?'modest':p<1.5?'decent':p<4?'good':p<8?'solid':'large';};

  function detect(t,all,list){
    var out=[],p=pnl(t),bal=S.bal,m=t.mult,wp=wipe(m);
    var lastLoss=all.filter(function(x){return x.closeTime<=t.startTime&&pnl(x)<0;}).sort(function(a,b){return a.closeTime-b.closeTime;}).pop();
    if(lastLoss&&(t.startTime-lastLoss.closeTime)<=20*60000) out.push('Opened <b>soon after a loss</b> — watch that this isn’t an emotional revenge trade.');
    var wpS=wp>=1?wp.toFixed(1):wp.toFixed(2);
    out.push(m<=10?('low leverage <b>×'+m+'</b> — comfortable buffer, ~'+wpS+'% against you to a margin call 👍'):m<=50?('moderate leverage <b>×'+m+'</b> — margin call around ~'+wpS+'% against you'):m<=150?('high leverage <b>×'+m+'</b> — real risk: ~'+wpS+'% against you already eats the position'):m<=500?('very high leverage <b>×'+m+'</b> — on the edge: ~'+wpS+'% against nearly zeroes your stake'):('extreme leverage <b>×'+m+'</b> — just <b>~'+wpS+'%</b> against is enough to wipe the position'));
    if(t.stopLossPrice==null&&p<0) out.push('No <b>stop-loss</b> — at this leverage nothing capped the loss.');
    else if(t.stopLossPrice==null) out.push('No <b>stop-loss</b> — the trade risk wasn’t capped in advance.');
    var expo=bal?t.sumInv/bal*100:0; if(expo>=15) out.push('This single position held <b>'+expo.toFixed(0)+'% of your deposit</b> — high concentration of capital at risk.');
    if(S.medSum&&t.sumInv>S.medSum*1.8) out.push('Margin <b>larger than usual</b> (~$'+fmt(t.sumInv)+' vs your median ~$'+fmt(S.medSum)+').');
    var d=(t.closeTime-t.startTime)/60000;
    if(S.medDur&&d>Math.max(S.medDur*3,30)&&p<0) out.push('You <b>held it a long time</b> ('+Math.round(d)+' min) — the loss dragged on longer than usual.');
    var s=1;for(var i=list.length-2;i>=0;i--){var q=pnl(list[i]);if(q!==0&&p!==0&&(q>0)===(p>0))s++;else break;}
    if(p>0&&s>=3) out.push('That’s <b>'+s+' wins in a row</b> 🔥 — nice streak, but don’t crank leverage on the buzz.');
    if(p<0&&s>=3) out.push('Already <b>'+s+' losses in a row</b> — a good moment to pause.');
    if(list.length>=2&&list[list.length-2].alias===t.alias) out.push('Again <b>'+t.alias+'</b> — you’re concentrating on one instrument.');
    return out;
  }
  function comment(t,all,list){
    var p=pnl(t),bal=readBal(),pct=bal?Math.abs(p)/bal*100:0,expo=bal?t.sumInv/bal*100:0;
    var move=moveOf(t),pin=t.sumInv?p/t.sumInv*100:0,notion=t.sumInv*t.mult;
    var mood=p<0?'😕':p>0?'✅':'➖',acc=p<0?C.br:p>0?C.pos:C.t2;
    var ti=p<0?'Trade review: loss':p>0?'Trade review: profit':'Break-even trade';
    var head=p===0?('Your <b>'+t.alias+'</b> trade closed at break-even.'):rot(p<0?LOSS:WIN,p<0?'l':'w').replace('{a}',t.alias).replace('{v}',sgn(p));
    var pctS=pct>0?(pct.toFixed(2)==='0.00'?'0.01':pct.toFixed(2)):'0.00';
    var balS=p<0?(' That’s a <b>'+magW(pct)+'</b> loss — <b style="color:'+C.neg+'">−'+pctS+'%</b> of your deposit ($'+fk(bal)+').'):p>0?(' '+magWW(pct).replace(/^./,function(c){return c.toUpperCase();})+' gain — <b style="color:'+C.pos+'">'+pctS+'%</b> of your deposit ($'+fk(bal)+').'):'';
    var moveS=t.mult>=20?(' ⚙️ Price moved only <b>'+(move>=0?'+':'')+move.toFixed(2)+'%</b>, but <b>×'+t.mult+'</b> leverage turned it into <b style="color:'+(p<0?C.neg:C.pos)+'">'+(pin>=0?'+':'')+pin.toFixed(1)+'%</b> of your invested (volume ~$'+fk(notion)+').'):'';
    var patsArr=detect(t,all,list).slice(0,2);
    var nudge=p<0&&t.stopLossPrice==null?(rot(['A gentle tip for next time: a stop-loss at this leverage is genuinely your best friend — it would have softened this one.','No pressure — but setting an SL next time quietly caps the downside. Worth making a habit.'],'nsl')):(p>0&&t.stopLossPrice!=null?(rot(['Profit and a stop in place — that’s exactly how it’s done. 👏','Green and protected with a stop — lovely, keep it up.'],'good')):'');
    var B=['<div style="line-height:1.6">'+head+balS+'</div>'];
    if(moveS) B.push('<div style="margin-top:11px;padding-top:11px;border-top:1px solid '+C.line+';line-height:1.55">'+moveS.replace(/^\s+/,'')+'</div>');
    if(patsArr.length) B.push('<div style="margin-top:11px;padding-top:11px;border-top:1px solid '+C.line+'">'+patsArr.map(function(x,i){return '<div style="display:flex;gap:8px;line-height:1.5'+(i?';margin-top:6px':'')+'"><span style="color:'+C.br+';font-weight:800">•</span><span>'+x+'</span></div>';}).join('')+'</div>');
    if(nudge) B.push('<div style="margin-top:11px;background:rgba(255,164,8,.09);border:1px solid rgba(255,164,8,.30);border-radius:10px;padding:9px 11px;line-height:1.5">💡 '+nudge+'</div>');
    return {m:mood,a:acc,ti:ti,h:B.join(''),chip:t.alias,time:new Date(t.closeTime).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})};
  }

  function review(list){
    var bal=readBal(),w=list.filter(win),l=list.filter(loss),n=list.length;
    var net=sum(list.map(pnl)),avgW=w.length?sum(w.map(pnl))/w.length:0,avgL=l.length?sum(l.map(pnl))/l.length:0;
    var rr=avgW>0?Math.abs(avgL)/avgW:99,pf=l.length?sum(w.map(pnl))/Math.abs(sum(l.map(pnl))||1):99,exp=net/n;
    var bwT=list.slice().sort(function(a,b){return pnl(b)-pnl(a);})[0],blT=list.slice().sort(function(a,b){return pnl(a)-pnl(b);})[0];
    var slp=Math.round(100*list.filter(function(t){return t.stopLossPrice!=null;}).length/n),noSL=list.filter(function(t){return t.stopLossPrice==null;}).length;
    var mults=list.map(function(t){return t.mult;}),mAvg=Math.round(sum(mults)/n),mMax=Math.max.apply(null,mults),medMult=med(mults),mcDist=100/medMult;
    var durs=list.map(function(t){return (t.closeTime-t.startTime)/60000;}),dMed=Math.round(med(durs)),dMin=Math.round(Math.min.apply(null,durs)),dMax=Math.round(Math.max.apply(null,durs));
    var sums=list.map(function(t){return t.sumInv;}),avgSum=sum(sums)/n,avgNot=avgSum*mAvg;
    var expoMax=Math.round(100*Math.max.apply(null,sums)/bal),notMax=Math.max.apply(null,list.map(function(t){return t.sumInv*t.mult;}));
    var over=list.filter(function(t){return S.medSum&&t.sumInv>S.medSum*1.8;}).length;
    var revenge=list.filter(function(t){var ll=S.baseAll.concat(S.newTrades).filter(function(x){return x.closeTime<=t.startTime&&pnl(x)<0;}).pop();return ll&&(t.startTime-ll.closeTime)<=20*60000;}).length;
    var mws=0,mls=0,cw=0,cl=0;list.forEach(function(t){var p=pnl(t);if(p>0){cw++;cl=0;mws=Math.max(mws,cw);}else if(p<0){cl++;cw=0;mls=Math.max(mls,cl);}else{cw=0;cl=0;}});
    var by={},cnt={};list.forEach(function(t){by[t.alias]=(by[t.alias]||0)+pnl(t);cnt[t.alias]=(cnt[t.alias]||0)+1;});
    var ks=Object.keys(by),bestA=ks[0],worstA=ks[0];ks.forEach(function(k){if(by[k]>by[bestA])bestA=k;if(by[k]<by[worstA])worstA=k;});
    var topA=Object.keys(cnt).sort(function(a,b){return cnt[b]-cnt[a];})[0],conc=Math.round(100*cnt[topA]/n),nAss=Object.keys(cnt).length;
    var lb=S.baseAll,lwr=lb.length?Math.round(100*lb.filter(win).length/lb.length):0,wr=Math.round(100*w.length/n),pctNet=bal?net/bal*100:0;
    var disc=Math.max(1,Math.min(10,Math.round(slp/100*5+(mAvg<=10?3:mAvg<=50?1:0)+(expoMax<20?2:0))));
    var cons=Math.max(1,Math.min(10,Math.round(wr/10*0.6+(mls<=2?4:mls<=4?2:0))));
    var rat=Math.max(1,Math.min(10,Math.round(10-Math.min(6,rr)-(revenge>2?2:revenge>0?1:0)-(mAvg>=200?1:0))));
    var styleName=dMed<3?'scalper':dMed<60?'intraday trader':dMed<1440?'day/swing trader':'swing trader';
    var levDesc=mAvg>500?'with extreme leverage (avg ×'+mAvg+')':mAvg>150?'with very high leverage (avg ×'+mAvg+')':mAvg>50?'with high leverage (avg ×'+mAvg+')':mAvg>10?'with moderate leverage (avg ×'+mAvg+')':'with modest leverage (avg ×'+mAvg+')';
    var concDesc=conc>60?('heavily concentrated in <b>'+topA+'</b> ('+conc+'% of trades)'):('spread across '+nAss+' instruments');
    var trend=(wr>=lwr&&net>=0)?'an overall improvement':(net<0?'more of a decline':'mixed dynamics');
    var gf=[];if(rr>3)gf.push('you book profits early but let losses run — your average loss is <b>'+Math.round(rr)+'×</b> your average win (the classic skew)');if(revenge>0)gf.push('<b>'+revenge+'</b> trades opened soon after a loss — possible emotional revenge trades');if(mls>=3)gf.push('a streak of <b>'+mls+'</b> losses in a row — a moment where it matters not to raise your stakes');if(over>0)gf.push('<b>'+over+'</b> trades with margin notably larger than usual');
    var sections=[
      {h:'1. Style profile',html:'You are mostly a <b>'+styleName+'</b> — median hold '+dMed+' min. You trade '+levDesc+', '+concDesc+'.'},
      {h:'2. Parameters over '+n+' trades',list:['Total trades: <b>'+n+'</b>','Winners: <b>'+w.length+' of '+n+'</b> ('+wr+'%)','Largest profit: '+bwT.alias+' (<b style="color:'+C.pos+'">'+sgn(pnl(bwT))+'</b>)','Largest loss: '+blT.alias+' (<b style="color:'+C.neg+'">'+sgn(pnl(blT))+'</b>)','Average profit / loss: <b>'+sgn(avgW)+'</b> / <b>'+sgn(avgL)+'</b>','Average margin × leverage: $'+fmt(avgSum)+' × ×'+mAvg+' ≈ volume <b>$'+fk(avgNot)+'</b>','Trades with a stop-loss: <b>'+slp+'%</b>','Leverage: avg ×'+mAvg+', max ×'+mMax,'Duration: median '+dMed+' min ('+dMin+'–'+dMax+')']},
      {h:'3. Dynamics',html:'Net result — <b style="color:'+(net>=0?C.pos:C.neg)+'">'+sgn(net)+'</b> ('+(pctNet>=0?'+':'')+pctNet.toFixed(1)+'% of deposit). Win rate '+wr+'% vs '+lwr+'% over your whole history. Best asset — <b>'+bestA+'</b> ('+sgn(by[bestA])+'), weakest — <b>'+worstA+'</b> ('+sgn(by[worstA])+'). This is '+trend+'.'},
      {h:'4. Risk patterns',html:'The main risk amplifier is leverage: at an average of ×'+mAvg+' a margin call hits after just ~<b>'+mcDist.toFixed(1)+'%</b> against you. Your largest position took <b>'+expoMax+'% of your deposit</b> (notional up to $'+fk(notMax)+'). A stop-loss was set on <b>'+slp+'%</b> of trades'+(noSL>0?(' — '+noSL+' unprotected.'):'.')},
      {h:'5. Greed & fear',html:gf.length?('A couple of things I gently noticed: '+gf.join('; ')+'. Nothing to beat yourself up over — just worth seeing.'):'No obvious emotional patterns here — no revenge trades, no size spikes. You’re keeping a cool head 🕊 nice.'},
      {h:'6. Progress & takeaway',html:(slp<50?'If there’s one thing to work on, it’s <b>stop-loss discipline</b> — and honestly, that alone would change a lot. ':'Your stop-loss discipline is looking good — keep it up. ')+(mAvg>=100?'Easing off the leverage a touch would also give your margin more breathing room on the usual swings.':'Your leverage is sensible — that’s looking after your account nicely.')}
    ];
    return {list:list,sections:sections,scores:[['Consistency',cons,'win rate '+wr+'%, loss streak '+mls],['Discipline',disc,'stops '+slp+'%, leverage ×'+mAvg+', margin '+expoMax+'%'],['Rational',rat,'R:R 1:'+(rr>50?'∞':rr.toFixed(1))+', revenge '+revenge]],
      habit:slp<50?'set a stop-loss on every trade (mandatory at high leverage)':(mAvg>=100?'lower your leverage — it multiplies the risk of losing your margin':(rr>3?'cut losses faster and let profits run':'keep size and leverage within reason'))};
  }

  var NAV=80;
  var box=document.createElement('div');
  box.style.cssText='position:fixed;left:8px;right:8px;bottom:'+NAV+'px;z-index:2147483000;background:linear-gradient(180deg,#1b1b1b,#141414);border:1px solid rgba(255,164,8,.45);border-radius:18px;box-shadow:0 0 0 1px rgba(255,164,8,.18),0 18px 50px -14px rgba(0,0,0,.85);font-family:'+C.font+';color:'+C.t+';overflow:hidden';
  box.innerHTML='<div style="display:flex;align-items:center;gap:9px;padding:12px 13px;border-bottom:1px solid '+C.line+';background:linear-gradient(180deg,rgba(255,164,8,.10),transparent)"><div style="width:30px;height:30px;border-radius:9px;background:'+C.br+';display:grid;place-items:center;font-weight:800;color:#000;font-size:16px">⛨</div><div style="font-weight:700;font-size:15px;line-height:1.1">Trading Coach<div style="font-weight:500;font-size:11px;color:'+C.t2+'">live • demo account</div></div><div style="margin-left:auto;display:flex;align-items:center;gap:6px;font-size:11px;color:'+C.t2+'"><span style="width:8px;height:8px;border-radius:50%;background:'+C.pos+';box-shadow:0 0 0 4px rgba(83,166,66,.15)"></span>watching</div><button id="lbxMin" style="width:32px;height:32px;border:0;background:'+C.rs+';color:'+C.t2+';cursor:pointer;font-size:18px;border-radius:9px;margin-left:4px">–</button></div><div style="display:flex;align-items:center;justify-content:space-between;padding:9px 13px;border-bottom:1px solid '+C.line+';color:'+C.t2+';font-size:12px"><span id="lbxCnt">new trades: '+S.newCount+'</span><span style="display:flex;gap:8px;align-items:center"><button id="lbxPrev" style="width:32px;height:32px;border:1px solid '+C.line+';background:'+C.sf+';color:'+C.t+';border-radius:8px;cursor:pointer;font-size:16px">‹</button><span id="lbxPos" style="min-width:46px;text-align:center;font-family:monospace">–</span><button id="lbxNext" style="width:32px;height:32px;border:1px solid '+C.line+';background:'+C.sf+';color:'+C.t+';border-radius:8px;cursor:pointer;font-size:16px">›</button></span></div><div id="lbxCard" style="padding:15px 15px 17px;max-height:66vh;overflow:auto"></div>';
  document.body.appendChild(box);
  var pill=document.createElement('div');
  pill.style.cssText='position:fixed;top:116px;right:8px;z-index:2147483000;display:none;align-items:center;gap:8px;padding:8px 12px;border-radius:40px;cursor:grab;background:linear-gradient(180deg,#2a2314,#1b1b1b);border:1.5px solid #FFA408;box-shadow:0 0 0 1px rgba(255,164,8,.30),0 6px 22px -4px rgba(255,164,8,.55),0 12px 34px -12px rgba(0,0,0,.75);font-family:'+C.font+';color:'+C.t+';touch-action:none;user-select:none;animation:lbxGlow 2.4s ease-in-out infinite';
  pill.innerHTML='<div style="width:26px;height:26px;border-radius:50%;background:'+C.br+';display:grid;place-items:center;color:#000;font-weight:800">⛨</div><b style="font-size:14px">Coach</b><span id="lbxPip" style="min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:'+C.neg+';color:#fff;font:700 12px '+C.font+';display:inline-flex;align-items:center;justify-content:center;text-align:center;box-sizing:border-box">'+S.newCount+'</span>';
  document.body.appendChild(pill);
  if(!document.getElementById('lbxGlowKf')){var kf=document.createElement('style');kf.id='lbxGlowKf';kf.textContent='@keyframes lbxGlow{0%,100%{box-shadow:0 0 0 1px rgba(255,164,8,.30),0 6px 22px -4px rgba(255,164,8,.50),0 12px 34px -12px rgba(0,0,0,.75)}50%{box-shadow:0 0 0 1px rgba(255,164,8,.55),0 6px 26px -2px rgba(255,164,8,.85),0 12px 34px -12px rgba(0,0,0,.75)}}';document.head.appendChild(kf);}
  box.style.transition='transform .34s cubic-bezier(.16,1,.3,1),opacity .26s ease';box.style.transformOrigin='top right';pill.style.transition='transform .36s cubic-bezier(.18,1.6,.35,1),opacity .24s ease';
  function expand(){box.style.display='block';box.style.transform='translateY(-30px) scale(.28)';box.style.opacity='0';void box.offsetWidth;box.style.transform='translateY(0) scale(1)';box.style.opacity='1';pill.style.transform='scale(.15)';pill.style.opacity='0';setTimeout(function(){pill.style.display='none';pill.style.transform='';pill.style.opacity='';},280);}
  function collapse(){pill.style.display='flex';pill.style.transform='scale(0)';pill.style.opacity='0';void pill.offsetWidth;pill.style.transform='scale(1)';pill.style.opacity='1';box.style.transform='translateY(-30px) scale(.28)';box.style.opacity='0';setTimeout(function(){box.style.display='none';box.style.transform='';box.style.opacity='';},340);}
  var elCard=box.querySelector('#lbxCard'),elCnt=box.querySelector('#lbxCnt'),elPos=box.querySelector('#lbxPos');
  function render(){
    if(!S.cards.length){elCard.innerHTML='<div style="color:'+C.t2+';font-size:14px;line-height:1.55">Hey 👋 I’m your Trading Coach. After each trade I’ll give you a quick, honest read — and every 5 trades a full review of your style, risk and habits, with scores. Balance ~$'+fk(readBal())+'. <b style="color:'+C.t+'">Make your first trade and we’re off.</b></div>';elPos.textContent='–';return;}
    if(S.idx<0)S.idx=0;if(S.idx>S.cards.length-1)S.idx=S.cards.length-1;var c=S.cards[S.idx];
    elCard.innerHTML='<div style="display:flex;align-items:center;gap:9px;margin-bottom:10px"><span style="font-size:24px">'+c.m+'</span><span style="font:400 12px/16px '+C.font+';color:'+C.t2+';background:'+C.sf+';border:1px solid '+C.line+';padding:3px 7px;border-radius:4px">'+c.chip+'</span><span style="margin-left:auto;font-size:11px;color:'+C.t2+';font-family:monospace">'+c.time+'</span></div><div style="font-weight:700;font-size:16px;margin-bottom:8px;border-left:3px solid '+c.a+';padding-left:10px;margin-left:-2px">'+c.ti+'</div><div style="font-size:14px;line-height:1.6;color:#cdd6e4;padding-left:10px">'+c.h+'</div>'+(c.review?'<button id="lbxRev" style="margin-top:14px;margin-left:10px;border:0;cursor:pointer;font:700 14px '+C.font+';background:'+C.br+';color:#000;padding:12px 16px;border-radius:11px;width:calc(100% - 10px)">📊 Open the full AI review of 5 trades</button>':(c.left?'<div style="margin-top:14px;margin-left:10px;display:flex;align-items:center;gap:10px"><div style="flex:1;height:6px;background:'+C.rs+';border-radius:4px;overflow:hidden"><i style="display:block;height:100%;width:'+((5-c.left)*20)+'%;background:'+C.br+'"></i></div><span style="font-size:12px;color:'+C.t2+';white-space:nowrap"><b style="color:'+C.t+'">'+c.left+'</b> more trade'+(c.left===1?'':'s')+' to your AI review</span></div>':''))+'<div style="margin-top:13px;margin-left:10px;padding-top:11px;border-top:1px solid '+C.line+';display:flex;align-items:center;gap:9px"><span style="font-size:11px;color:'+C.t2+'">Was this helpful?</span><button id="lbxUp" style="border:1px solid '+(c.vote==="up"?C.pos:C.line)+';background:'+(c.vote==="up"?"rgba(83,166,66,.15)":C.sf)+';color:'+C.t+';cursor:pointer;font-size:15px;border-radius:8px;padding:4px 10px">👍</button><button id="lbxDn" style="border:1px solid '+(c.vote==="down"?C.neg:C.line)+';background:'+(c.vote==="down"?"rgba(230,69,69,.15)":C.sf)+';color:'+C.t+';cursor:pointer;font-size:15px;border-radius:8px;padding:4px 10px">👎</button></div>';
    elPos.textContent=(S.idx+1)+' / '+S.cards.length;var rv=box.querySelector('#lbxRev');if(rv)rv.onclick=function(){showReview(c.review);};
    var up=box.querySelector('#lbxUp'),dn=box.querySelector('#lbxDn');if(up)up.onclick=function(){c.vote='up';render();toast('Thanks for the feedback! 👍',C.pos);};if(dn)dn.onclick=function(){c.vote='down';render();toast('Noted — thanks for telling me 👎',C.t2);};
  }
  function toast(txt,col){var e=document.createElement('div');e.style.cssText='position:fixed;left:8px;right:8px;top:10px;z-index:2147483001;background:'+C.rs+';border:1px solid '+(col||C.br)+';color:#fff;padding:12px 16px;border-radius:14px;font:600 14px '+C.font+';box-shadow:0 16px 40px -14px rgba(0,0,0,.7);text-align:center';e.textContent=txt;document.body.appendChild(e);setTimeout(function(){e.remove();},3200);}
  function showReview(r){var o=document.createElement('div');o.id='lbxOverlay';o.style.cssText='position:fixed;inset:0;z-index:2147483002;background:rgba(0,0,0,.65);display:flex;align-items:flex-end;font-family:'+C.font;
    var secH=r.sections.map(function(s){var body=s.list?('<ul style="margin:4px 0 0;padding-left:16px;color:#c4cede;font-size:13px;line-height:1.6">'+s.list.map(function(x){return '<li style="margin-bottom:3px">'+x+'</li>';}).join('')+'</ul>'):('<div style="color:#c4cede;font-size:13.5px;line-height:1.6;margin-top:3px">'+s.html+'</div>');return '<div style="padding:12px 0;border-bottom:1px solid #232323"><div style="font-weight:700;font-size:14.5px">'+s.h+'</div>'+body+'</div>';}).join('');
    var scH=r.scores.map(function(s){return '<div style="background:'+C.sf+';border:1px solid '+C.line+';border-radius:12px;padding:11px"><div style="font-size:10px;color:'+C.t2+';text-transform:uppercase">'+s[0]+'</div><div style="font:700 22px monospace;margin:3px 0 6px">'+s[1]+'<span style="font-size:11px;color:'+C.t2+'">/10</span></div><div style="height:5px;background:'+C.rs+';border-radius:4px;overflow:hidden"><i style="display:block;height:100%;width:'+(s[1]*10)+'%;background:'+C.br+'"></i></div><div style="font-size:9.5px;color:'+C.t2+';margin-top:6px;line-height:1.3">'+s[2]+'</div></div>';}).join('');
    o.innerHTML='<div style="width:100%;max-height:92vh;overflow:auto;background:linear-gradient(180deg,#1b1b1b,#141414);border-top:1px solid rgba(255,164,8,.5);border-radius:20px 20px 0 0;color:'+C.t+'"><div style="width:40px;height:5px;border-radius:4px;background:'+C.line+';margin:9px auto 2px"></div><div style="display:flex;align-items:center;gap:10px;padding:12px 17px;border-bottom:1px solid '+C.line+';position:sticky;top:0;background:#191919"><div style="width:30px;height:30px;border-radius:9px;background:'+C.br+';display:grid;place-items:center;color:#000;font-weight:800">⛨</div><div><b style="font-size:16px">AI Trading Review</b><div style="font-size:11px;color:'+C.t2+'">review of your last '+r.list.length+' trades</div></div><span style="margin-left:auto;cursor:pointer;color:'+C.t2+';font-size:28px;line-height:1" id="lbxRvX">×</span></div><div style="padding:6px 18px 30px">'+secH+'<div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:'+C.t2+';margin:16px 0 8px">Scores over '+r.list.length+' trades</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px">'+scH+'</div><div style="margin-top:16px;background:rgba(255,164,8,.10);border:1px solid rgba(255,164,8,.35);border-radius:12px;padding:13px;font-size:14px"><b style="color:'+C.br+'">Habit #1 for the next '+r.list.length+':</b> '+r.habit+'.</div><div style="margin-top:16px;text-align:center"><div style="font-size:12px;color:'+C.t2+';margin-bottom:8px">How helpful was this review?</div><div id="lbxStars" style="display:flex;justify-content:center;gap:7px;font-size:27px">'+[0,1,2,3,4].map(function(i){return '<span data-i="'+i+'" style="cursor:pointer;color:'+C.t2+'">★</span>';}).join('')+'</div><div id="lbxStarMsg" style="font-size:11px;color:'+C.pos+';margin-top:7px;height:14px"></div></div><div style="margin-top:14px;font-size:12px;color:'+C.t2+';font-style:italic">AI can make mistakes. This is a review of behaviour and risk profile, not investment advice.</div></div></div>';
    document.body.appendChild(o);o.querySelector('#lbxRvX').onclick=function(){o.remove();};o.onclick=function(e){if(e.target===o)o.remove();};
    var stars=o.querySelectorAll('#lbxStars span');function paint(k){for(var i=0;i<stars.length;i++)stars[i].style.color=i<=k?C.br:C.t2;}
    for(var si=0;si<stars.length;si++){(function(i){stars[i].onmouseenter=function(){paint(i);};stars[i].onclick=function(){r.rating=i+1;paint(i);o.querySelector('#lbxStarMsg').textContent='Thanks for rating this review! 🙏';};})(si);}
    o.querySelector('#lbxStars').onmouseleave=function(){paint((r.rating||0)-1);};if(r.rating)paint(r.rating-1);
  }
  function process(list){
    var fresh=list.filter(function(t){return !S.seen[t.ticket];}).sort(function(a,b){return a.closeTime-b.closeTime;});
    if(!fresh.length)return;
    fresh.forEach(function(t){S.seen[t.ticket]=1;S.newTrades.push(t);S.newCount++;var all=S.baseAll.concat(S.newTrades);var card=comment(t,all,S.newTrades);if(S.newCount%5===0)card.review=review(S.newTrades.slice(-5));else card.left=5-(S.newCount%5);S.cards.push(card);S.idx=S.cards.length-1;});
    elCnt.textContent='new trades: '+S.newCount;var pip=pill.querySelector('#lbxPip');if(pip)pip.textContent=S.newCount;render();
    var last=fresh[fresh.length-1],lp=pnl(last);toast((S.newCount%5===0?'🧠 Your AI Trading Review of 5 trades is ready! • ':'')+'Trade '+sgn(lp)+' — '+last.alias,lp>=0?C.pos:C.neg);
  }
  function poll(){readBal();fetch(API,{headers:{'Accept':'application/json'},credentials:'include'}).then(function(r){return r.json();}).then(function(j){var list=(j&&j.result&&j.result.closed)||[];if(!S.init){S.init=true;list.forEach(function(t){S.seen[t.ticket]=1;});S.baseAll=list.slice();S.medSum=med(list.map(function(t){return t.sumInv;}));S.medDur=med(list.map(function(t){return (t.closeTime-t.startTime)/60000;}));render();}else{process(list);}}).catch(function(){});}
  box.querySelector('#lbxPrev').onclick=function(){S.idx--;render();};box.querySelector('#lbxNext').onclick=function(){S.idx++;render();};box.querySelector('#lbxMin').onclick=function(){collapse();};
  var dg=false,sx=0,sy=0,ox=0,oy=0,mv=0;
  pill.addEventListener('pointerdown',function(e){dg=true;mv=0;var r=pill.getBoundingClientRect();sx=e.clientX;sy=e.clientY;ox=e.clientX-r.left;oy=e.clientY-r.top;pill.style.animation='none';pill.style.cursor='grabbing';try{pill.setPointerCapture(e.pointerId);}catch(_){}e.preventDefault();});
  pill.addEventListener('pointermove',function(e){if(!dg)return;mv+=Math.abs(e.clientX-sx)+Math.abs(e.clientY-sy);sx=e.clientX;sy=e.clientY;var w=pill.offsetWidth,h=pill.offsetHeight;pill.style.left=Math.max(4,Math.min(innerWidth-w-4,e.clientX-ox))+'px';pill.style.top=Math.max(4,Math.min(innerHeight-h-4,e.clientY-oy))+'px';pill.style.right='auto';pill.style.bottom='auto';e.preventDefault();});
  function pu(){if(!dg)return;dg=false;pill.style.cursor='grab';pill.style.animation='lbxGlow 2.4s ease-in-out infinite';if(mv<7){expand();}}
  pill.addEventListener('pointerup',pu);pill.addEventListener('pointercancel',pu);
  function lbxOutside(e){if(box.style.display==='none')return;if(box.contains(e.target)||pill.contains(e.target))return;if(document.getElementById('lbxOverlay'))return;collapse();}
  document.addEventListener('pointerdown',lbxOutside,true);
  render();poll();var iv=setInterval(poll,15000);window.__lbxCoachStop=function(){clearInterval(iv);try{document.removeEventListener('pointerdown',lbxOutside,true);box.remove();pill.remove();}catch(e){}};
  return 'v2.2 EN (GA-style review) injected; carried '+S.newCount+' trades';
})();
