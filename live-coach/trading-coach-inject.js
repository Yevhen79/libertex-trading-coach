/*
 * Libertex Trading Coach — live in-terminal overlay (v2.2)
 * ---------------------------------------------------------
 * A behavioural coach that runs INSIDE the logged-in Libertex web terminal.
 * Polls the same closed-positions API the app uses (same-origin, session cookies),
 * reacts to every NEW closed trade with an expanded, leverage- & balance-aware comment,
 * and every 10 new trades produces a Guardian-Angel-style "AI Trading Review".
 *
 * HOW TO RUN (demo / prototype):
 *   1. Open https://app.libertex.org (desktop or /m mobile view) and log in.
 *      Select the account you want to coach (e.g. the Demo account).
 *   2. Open DevTools console (or inject via a trusted extension) and paste this whole file.
 *   3. A floating orange-outlined "Trading Coach" widget appears. It seeds a baseline from
 *      your current history, then reacts to trades you close from that point on.
 *   Note: lives in page memory — a hard reload (F5) removes it; just paste again.
 *
 * DATA SOURCE (discovered):
 *   GET /spa/report/closed-positions?page=1&pageSize=100&order=CloseTime&orderDir=desc&searchPhrase=
 *   -> { result: { closed: [ { ticket, symbol, alias, direction(growth=buy|reduction=sell),
 *                              mult, sumInv(margin), equityInv, startRate, closeRate,
 *                              startTime, closeTime, stopLossPrice, takeProfitPrice }, ... ], summary } }
 *   P&L = equityInv - sumInv ;  position volume (notional) = sumInv * mult
 *   Balance read from the terminal DOM: .spare-cash  (free funds).
 *
 * NOTE: this is a hackathon prototype (client-side overlay). Production would be a
 * server-side integration on the closed-positions feed by account id.
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
  var fmt=function(n){return (Math.round(Math.abs(n)*100)/100).toLocaleString('ru-RU',{maximumFractionDigits:2});};
  var sgn=function(n){return (n>=0?'+':'−')+'$'+fmt(n);};
  var fk=function(n){return n>=1000?(Math.round(n/100)/10).toLocaleString('ru-RU')+'k':fmt(n);};
  var med=function(a){if(!a.length)return 0;var b=a.slice().sort(function(x,y){return x-y;});return b[Math.floor(b.length/2)];};
  var moveOf=function(t){return t.direction==='growth'?(t.closeRate-t.startRate)/t.startRate*100:(t.startRate-t.closeRate)/t.startRate*100;};
  var wipe=function(m){return m?100/m:100;};
  function readBal(){try{var el=document.querySelector('.spare-cash');if(el){var n=parseFloat((el.textContent||'').replace(/[^0-9.]/g,''));if(n>0)S.bal=n;}}catch(e){}return S.bal;}
  function rot(pool,key){var i=(S.rot[key]||0)%pool.length;S.rot[key]=(S.rot[key]||0)+1;return pool[i];}
  function plu(n){var a=n%100,b=n%10;return (a>10&&a<20)?'сделок':(b===1?'сделка':(b>=2&&b<=4?'сделки':'сделок'));}
  var LOSS=['Ну что ж, <b>{a}</b> закрылась в минус на <b>{v}</b> — бывает у всех.','В этот раз не срослось: <b>{a}</b> ушла в <b>{v}</b>. Идём дальше. 🙂','Минус по <b>{a}</b> — <b>{v}</b>. Это часть игры, извлечём урок.','Не повезло — <b>{a}</b> закрылась в <b>{v}</b>. Не бери близко к сердцу.','<b>{a}</b> ушла в красную зону: <b>{v}</b>. Главное — что дальше.'];
  var WIN=['Красиво — плюс по <b>{a}</b> на <b>{v}</b>! 👍','Зелёная сделка: <b>{a}</b> закрыта в <b>{v}</b>. Молодец. 🙂','Ты зафиксировал <b>{v}</b> по <b>{a}</b> — хорошая работа. ✅','Вот так и надо — <b>{a}</b> в плюс на <b>{v}</b>.','В плюс по <b>{a}</b>: <b>{v}</b>. Так держать!'];
  var magW=function(p){return p<0.5?'почти незаметный':p<1.5?'небольшой':p<4?'заметный':p<8?'существенный':'крупный';};
  var magWW=function(p){return p<0.5?'скромный':p<1.5?'неплохой':p<4?'хороший':p<8?'солидный':'крупный';};

  function detect(t,all,list){
    var out=[],p=pnl(t),bal=S.bal,m=t.mult,wp=wipe(m);
    var lastLoss=all.filter(function(x){return x.closeTime<=t.startTime&&pnl(x)<0;}).sort(function(a,b){return a.closeTime-b.closeTime;}).pop();
    if(lastLoss&&(t.startTime-lastLoss.closeTime)<=20*60000) out.push('Открыта <b>вскоре после убытка</b> — следи, чтобы это не был эмоциональный отыгрыш.');
    var wpS=wp>=1?wp.toFixed(1):wp.toFixed(2);
    out.push(m<=10?('низкое плечо <b>×'+m+'</b> — комфортный запас, ~'+wpS+'% против тебя до margin call 👍'):m<=50?('умеренное плечо <b>×'+m+'</b> — до margin call ~'+wpS+'% движения против'):m<=150?('высокое плечо <b>×'+m+'</b> — риск ощутимый: ~'+wpS+'% против тебя уже съедает позицию'):m<=500?('очень высокое плечо <b>×'+m+'</b> — на грани: ~'+wpS+'% против почти обнуляет вложенное'):('экстремальное плечо <b>×'+m+'</b> — хватает <b>~'+wpS+'%</b> против, чтобы стереть позицию'));
    if(t.stopLossPrice==null&&p<0) out.push('Без <b>стоп-лосса</b> — при таком плече убыток ничем не был ограничен.');
    else if(t.stopLossPrice==null) out.push('Без <b>стоп-лосса</b> — риск в сделке не был ограничен заранее.');
    var expo=bal?t.sumInv/bal*100:0; if(expo>=15) out.push('В одной позиции было <b>'+expo.toFixed(0)+'% депозита</b> — высокая концентрация капитала под риском.');
    if(S.medSum&&t.sumInv>S.medSum*1.8) out.push('Маржа <b>крупнее обычного</b> (~$'+fmt(t.sumInv)+' против медианы ~$'+fmt(S.medSum)+').');
    var d=(t.closeTime-t.startTime)/60000;
    if(S.medDur&&d>Math.max(S.medDur*3,30)&&p<0) out.push('Позицию <b>держал долго</b> ('+Math.round(d)+' мин) — убыток тянулся дольше обычного.');
    var s=1;for(var i=list.length-2;i>=0;i--){var q=pnl(list[i]);if(q!==0&&p!==0&&(q>0)===(p>0))s++;else break;}
    if(p>0&&s>=3) out.push('Это <b>'+s+'-я прибыль подряд</b> 🔥 — серия идёт, но не поднимай плечо на азарте.');
    if(p<0&&s>=3) out.push('Уже <b>'+s+'-й убыток подряд</b> — хороший момент сделать паузу.');
    if(list.length>=2&&list[list.length-2].alias===t.alias) out.push('Снова <b>'+t.alias+'</b> — заметна концентрация на одном инструменте.');
    return out;
  }
  function comment(t,all,list){
    var p=pnl(t),bal=readBal(),pct=bal?Math.abs(p)/bal*100:0,expo=bal?t.sumInv/bal*100:0;
    var move=moveOf(t),pin=t.sumInv?p/t.sumInv*100:0,notion=t.sumInv*t.mult;
    var mood=p<0?'😕':p>0?'✅':'➖',acc=p<0?C.br:p>0?C.pos:C.t2;
    var ti=p<0?'Разбор сделки: минус':p>0?'Разбор сделки: плюс':'Сделка в ноль';
    var head=p===0?('Сделка по <b>'+t.alias+'</b> закрылась в ноль.'):rot(p<0?LOSS:WIN,p<0?'l':'w').replace('{a}',t.alias).replace('{v}',sgn(p));
    var pctS=pct>0?(pct.toFixed(2)==='0.00'?'0.01':pct.toFixed(2)):'0.00';
    var balS=p<0?(' Это <b>'+magW(pct)+'</b> убыток — <b style="color:'+C.neg+'">−'+pctS+'%</b> депозита ($'+fk(bal)+').'):p>0?(' '+magWW(pct).replace(/^./,function(c){return c.toUpperCase();})+' плюс — <b style="color:'+C.pos+'">'+pctS+'%</b> депозита ($'+fk(bal)+').'):'';
    var moveS=t.mult>=20?(' ⚙️ Цена прошла всего <b>'+(move>=0?'+':'')+move.toFixed(2)+'%</b>, но плечо <b>×'+t.mult+'</b> превратило это в <b style="color:'+(p<0?C.neg:C.pos)+'">'+(pin>=0?'+':'')+pin.toFixed(1)+'%</b> от вложенного (объём ~$'+fk(notion)+').'):'';
    var patsArr=detect(t,all,list).slice(0,2);
    var nudge=p<0&&t.stopLossPrice==null?(rot(['Мягкий совет на будущее: при таком плече стоп-лосс — твой лучший друг, он бы аккуратно сгладил этот минус.','Без давления — но SL в следующий раз тихо ограничит просадку. Стоит сделать привычкой.'],'nsl')):(p>0&&t.stopLossPrice!=null?(rot(['Плюс и со стопом — вот это по-чемпионски. 👏','В плюс и под защитой стопа — красота, так держи.'],'good')):'');
    var B=['<div style="line-height:1.6">'+head+balS+'</div>'];
    if(moveS) B.push('<div style="margin-top:11px;padding-top:11px;border-top:1px solid '+C.line+';line-height:1.55">'+moveS.replace(/^\s+/,'')+'</div>');
    if(patsArr.length) B.push('<div style="margin-top:11px;padding-top:11px;border-top:1px solid '+C.line+'">'+patsArr.map(function(x,i){return '<div style="display:flex;gap:8px;line-height:1.5'+(i?';margin-top:6px':'')+'"><span style="color:'+C.br+';font-weight:800">•</span><span>'+x+'</span></div>';}).join('')+'</div>');
    if(nudge) B.push('<div style="margin-top:11px;background:rgba(255,164,8,.09);border:1px solid rgba(255,164,8,.30);border-radius:10px;padding:9px 11px;line-height:1.5">💡 '+nudge+'</div>');
    return {m:mood,a:acc,ti:ti,h:B.join(''),chip:t.alias,time:new Date(t.closeTime).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})};
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
    var styleName=dMed<3?'скальпер':dMed<60?'внутридневной трейдер':dMed<1440?'дей/свинг-трейдер':'свинг-трейдер';
    var levDesc=mAvg>500?'с экстремальным плечом (в среднем ×'+mAvg+')':mAvg>150?'с очень высоким плечом (в среднем ×'+mAvg+')':mAvg>50?'с высоким плечом (в среднем ×'+mAvg+')':mAvg>10?'с умеренным плечом (в среднем ×'+mAvg+')':'с невысоким плечом (в среднем ×'+mAvg+')';
    var concDesc=conc>60?('сильно сконцентрирован на <b>'+topA+'</b> ('+conc+'% сделок)'):('распределяешь сделки по '+nAss+' инструментам');
    var trend=(wr>=lwr&&net>=0)?'в целом улучшение':(net<0?'скорее ухудшение':'смешанная динамика');
    var gf=[];if(rr>3)gf.push('прибыль фиксируется рано, а убыткам даёшь течь — средний убыток в <b>'+Math.round(rr)+'×</b> больше среднего профита (классический перекос)');if(revenge>0)gf.push('<b>'+revenge+'</b> сделок открыты вскоре после убытка — возможные эмоциональные отыгрыши');if(mls>=3)gf.push('была серия из <b>'+mls+'</b> убытков подряд — момент, где важно не повышать ставки');if(over>0)gf.push('<b>'+over+'</b> сделок с маржой заметно крупнее обычного');
    var sections=[
      {h:'1. Профиль стиля',html:'Ты преимущественно <b>'+styleName+'</b> — медиана удержания '+dMed+' мин. Торгуешь '+levDesc+', '+concDesc+'.'},
      {h:'2. Параметры за '+n+' сделок',list:['Всего сделок: <b>'+n+'</b>','Прибыльных: <b>'+w.length+' из '+n+'</b> ('+wr+'%)','Крупнейший профит: '+bwT.alias+' (<b style="color:'+C.pos+'">'+sgn(pnl(bwT))+'</b>)','Крупнейший убыток: '+blT.alias+' (<b style="color:'+C.neg+'">'+sgn(pnl(blT))+'</b>)','Средний профит / убыток: <b>'+sgn(avgW)+'</b> / <b>'+sgn(avgL)+'</b>','Средняя маржа × плечо: $'+fmt(avgSum)+' × ×'+mAvg+' ≈ объём <b>$'+fk(avgNot)+'</b>','Сделок со стоп-лоссом: <b>'+slp+'%</b>','Плечо: среднее ×'+mAvg+', макс ×'+mMax,'Длительность: медиана '+dMed+' мин ('+dMin+'–'+dMax+')']},
      {h:'3. Динамика',html:'Чистый результат — <b style="color:'+(net>=0?C.pos:C.neg)+'">'+sgn(net)+'</b> ('+(pctNet>=0?'+':'')+pctNet.toFixed(1)+'% депозита). Win rate '+wr+'% против '+lwr+'% за всю историю. Лучший актив — <b>'+bestA+'</b> ('+sgn(by[bestA])+'), слабее всего — <b>'+worstA+'</b> ('+sgn(by[worstA])+'). Это '+trend+'.'},
      {h:'4. Риск-паттерны',html:'Главный усилитель риска — плечо: при среднем ×'+mAvg+' margin call наступает при движении всего ~<b>'+mcDist.toFixed(1)+'%</b> против тебя. Максимальная позиция занимала <b>'+expoMax+'% депозита</b> (ноционал до $'+fk(notMax)+'). Стоп-лосс стоял в <b>'+slp+'%</b> сделок'+(noSL>0?(' — '+noSL+' без защиты.'):'.')},
      {h:'5. Жадность и страх',html:gf.length?('Пара вещей, которые мягко подмечу: '+gf.join('; ')+'. Ничего страшного — просто чтобы ты это видел.'):'Явных эмоциональных всплесков не вижу — ни отыгрышей, ни резких раздуваний объёма. Ты держишь холодную голову 🕊 красиво.'},
      {h:'6. Прогресс и вывод',html:(slp<50?'Если и есть что подтянуть — это <b>дисциплина по стопам</b>, и, честно, одно это изменило бы многое. ':'Дисциплина по стопам у тебя на уровне — так держать. ')+(mAvg>=100?'А если чуть снизить плечо, у маржи будет больше воздуха на обычных колебаниях.':'Плечо в разумных пределах — это бережёт твой счёт.')}
    ];
    return {list:list,sections:sections,scores:[['Консистентность',cons,'win rate '+wr+'%, серия убытков '+mls],['Дисциплина',disc,'стопы '+slp+'%, плечо ×'+mAvg+', маржа '+expoMax+'%'],['Рациональность',rat,'R:R 1:'+(rr>50?'∞':rr.toFixed(1))+', отыгрышей '+revenge]],
      habit:slp<50?'ставить стоп-лосс на каждую сделку (при высоком плече — обязательно)':(mAvg>=100?'снизить плечо — оно кратно усиливает риск слить маржу':(rr>3?'резать убытки быстрее и давать прибыли расти':'держать размер и плечо в разумных пределах'))};
  }

  var NAV=80;
  var box=document.createElement('div');
  box.style.cssText='position:fixed;left:8px;right:8px;bottom:'+NAV+'px;z-index:2147483000;background:linear-gradient(180deg,#1b1b1b,#141414);border:1px solid rgba(255,164,8,.45);border-radius:18px;box-shadow:0 0 0 1px rgba(255,164,8,.18),0 18px 50px -14px rgba(0,0,0,.85);font-family:'+C.font+';color:'+C.t+';overflow:hidden';
  box.innerHTML='<div style="display:flex;align-items:center;gap:9px;padding:12px 13px;border-bottom:1px solid '+C.line+';background:linear-gradient(180deg,rgba(255,164,8,.10),transparent)"><div style="width:30px;height:30px;border-radius:9px;background:'+C.br+';display:grid;place-items:center;font-weight:800;color:#000;font-size:16px">⛨</div><div style="font-weight:700;font-size:15px;line-height:1.1">Trading Coach<div style="font-weight:500;font-size:11px;color:'+C.t2+'">live • демо-счёт</div></div><div style="margin-left:auto;display:flex;align-items:center;gap:6px;font-size:11px;color:'+C.t2+'"><span style="width:8px;height:8px;border-radius:50%;background:'+C.pos+';box-shadow:0 0 0 4px rgba(83,166,66,.15)"></span>слежу</div><button id="lbxMin" style="width:32px;height:32px;border:0;background:'+C.rs+';color:'+C.t2+';cursor:pointer;font-size:18px;border-radius:9px;margin-left:4px">–</button></div><div style="display:flex;align-items:center;justify-content:space-between;padding:9px 13px;border-bottom:1px solid '+C.line+';color:'+C.t2+';font-size:12px"><span id="lbxCnt">новых сделок: '+S.newCount+'</span><span style="display:flex;gap:8px;align-items:center"><button id="lbxPrev" style="width:32px;height:32px;border:1px solid '+C.line+';background:'+C.sf+';color:'+C.t+';border-radius:8px;cursor:pointer;font-size:16px">‹</button><span id="lbxPos" style="min-width:46px;text-align:center;font-family:monospace">–</span><button id="lbxNext" style="width:32px;height:32px;border:1px solid '+C.line+';background:'+C.sf+';color:'+C.t+';border-radius:8px;cursor:pointer;font-size:16px">›</button></span></div><div id="lbxCard" style="padding:15px 15px 17px;max-height:66vh;overflow:auto"></div>';
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
    if(!S.cards.length){elCard.innerHTML='<div style="color:'+C.t2+';font-size:14px;line-height:1.55">Привет 👋 Я твой Trading Coach. После каждой сделки дам короткий честный разбор, а раз в 5 сделок — полный обзор твоего стиля, риска и привычек с оценками. Баланс ~$'+fk(readBal())+'. <b style="color:'+C.t+'">Сделай первую сделку — и поехали.</b></div>';elPos.textContent='–';return;}
    if(S.idx<0)S.idx=0;if(S.idx>S.cards.length-1)S.idx=S.cards.length-1;var c=S.cards[S.idx];
    elCard.innerHTML='<div style="display:flex;align-items:center;gap:9px;margin-bottom:10px"><span style="font-size:24px">'+c.m+'</span><span style="font:400 12px/16px '+C.font+';color:'+C.t2+';background:'+C.sf+';border:1px solid '+C.line+';padding:3px 7px;border-radius:4px">'+c.chip+'</span><span style="margin-left:auto;font-size:11px;color:'+C.t2+';font-family:monospace">'+c.time+'</span></div><div style="font-weight:700;font-size:16px;margin-bottom:8px;border-left:3px solid '+c.a+';padding-left:10px;margin-left:-2px">'+c.ti+'</div><div style="font-size:14px;line-height:1.6;color:#cdd6e4;padding-left:10px">'+c.h+'</div>'+(c.review?'<button id="lbxRev" style="margin-top:14px;margin-left:10px;border:0;cursor:pointer;font:700 14px '+C.font+';background:'+C.br+';color:#000;padding:12px 16px;border-radius:11px;width:calc(100% - 10px)">📊 Открыть подробный AI-разбор 5 сделок</button>':(c.left?'<div style="margin-top:14px;margin-left:10px;display:flex;align-items:center;gap:10px"><div style="flex:1;height:6px;background:'+C.rs+';border-radius:4px;overflow:hidden"><i style="display:block;height:100%;width:'+((5-c.left)*20)+'%;background:'+C.br+'"></i></div><span style="font-size:12px;color:'+C.t2+';white-space:nowrap">ещё <b style="color:'+C.t+'">'+c.left+'</b> '+plu(c.left)+' до AI-разбора</span></div>':''))+'<div style="margin-top:13px;margin-left:10px;padding-top:11px;border-top:1px solid '+C.line+';display:flex;align-items:center;gap:9px"><span style="font-size:11px;color:'+C.t2+'">Полезно?</span><button id="lbxUp" style="border:1px solid '+(c.vote==="up"?C.pos:C.line)+';background:'+(c.vote==="up"?"rgba(83,166,66,.15)":C.sf)+';color:'+C.t+';cursor:pointer;font-size:15px;border-radius:8px;padding:4px 10px">👍</button><button id="lbxDn" style="border:1px solid '+(c.vote==="down"?C.neg:C.line)+';background:'+(c.vote==="down"?"rgba(230,69,69,.15)":C.sf)+';color:'+C.t+';cursor:pointer;font-size:15px;border-radius:8px;padding:4px 10px">👎</button></div>';
    elPos.textContent=(S.idx+1)+' / '+S.cards.length;var rv=box.querySelector('#lbxRev');if(rv)rv.onclick=function(){showReview(c.review);};
    var up=box.querySelector('#lbxUp'),dn=box.querySelector('#lbxDn');if(up)up.onclick=function(){c.vote='up';render();toast('Спасибо за отзыв! 👍',C.pos);};if(dn)dn.onclick=function(){c.vote='down';render();toast('Понял, спасибо 👎',C.t2);};
  }
  function toast(txt,col){var e=document.createElement('div');e.style.cssText='position:fixed;left:8px;right:8px;top:10px;z-index:2147483001;background:'+C.rs+';border:1px solid '+(col||C.br)+';color:#fff;padding:12px 16px;border-radius:14px;font:600 14px '+C.font+';box-shadow:0 16px 40px -14px rgba(0,0,0,.7);text-align:center';e.textContent=txt;document.body.appendChild(e);setTimeout(function(){e.remove();},3200);}
  function showReview(r){var o=document.createElement('div');o.id='lbxOverlay';o.style.cssText='position:fixed;inset:0;z-index:2147483002;background:rgba(0,0,0,.65);display:flex;align-items:flex-end;font-family:'+C.font;
    var secH=r.sections.map(function(s){var body=s.list?('<ul style="margin:4px 0 0;padding-left:16px;color:#c4cede;font-size:13px;line-height:1.6">'+s.list.map(function(x){return '<li style="margin-bottom:3px">'+x+'</li>';}).join('')+'</ul>'):('<div style="color:#c4cede;font-size:13.5px;line-height:1.6;margin-top:3px">'+s.html+'</div>');return '<div style="padding:12px 0;border-bottom:1px solid #232323"><div style="font-weight:700;font-size:14.5px">'+s.h+'</div>'+body+'</div>';}).join('');
    var scH=r.scores.map(function(s){return '<div style="background:'+C.sf+';border:1px solid '+C.line+';border-radius:12px;padding:11px"><div style="font-size:10px;color:'+C.t2+';text-transform:uppercase">'+s[0]+'</div><div style="font:700 22px monospace;margin:3px 0 6px">'+s[1]+'<span style="font-size:11px;color:'+C.t2+'">/10</span></div><div style="height:5px;background:'+C.rs+';border-radius:4px;overflow:hidden"><i style="display:block;height:100%;width:'+(s[1]*10)+'%;background:'+C.br+'"></i></div><div style="font-size:9.5px;color:'+C.t2+';margin-top:6px;line-height:1.3">'+s[2]+'</div></div>';}).join('');
    o.innerHTML='<div style="width:100%;max-height:92vh;overflow:auto;background:linear-gradient(180deg,#1b1b1b,#141414);border-top:1px solid rgba(255,164,8,.5);border-radius:20px 20px 0 0;color:'+C.t+'"><div style="width:40px;height:5px;border-radius:4px;background:'+C.line+';margin:9px auto 2px"></div><div style="display:flex;align-items:center;gap:10px;padding:12px 17px;border-bottom:1px solid '+C.line+';position:sticky;top:0;background:#191919"><div style="width:30px;height:30px;border-radius:9px;background:'+C.br+';display:grid;place-items:center;color:#000;font-weight:800">⛨</div><div><b style="font-size:16px">AI Trading Review</b><div style="font-size:11px;color:'+C.t2+'">разбор последних '+r.list.length+' сделок</div></div><span style="margin-left:auto;cursor:pointer;color:'+C.t2+';font-size:28px;line-height:1" id="lbxRvX">×</span></div><div style="padding:6px 18px 30px">'+secH+'<div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:'+C.t2+';margin:16px 0 8px">Оценки за '+r.list.length+' сделок</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px">'+scH+'</div><div style="margin-top:16px;background:rgba(255,164,8,.10);border:1px solid rgba(255,164,8,.35);border-radius:12px;padding:13px;font-size:14px"><b style="color:'+C.br+'">Привычка №1 на следующие '+r.list.length+':</b> '+r.habit+'.</div><div style="margin-top:16px;text-align:center"><div style="font-size:12px;color:'+C.t2+';margin-bottom:8px">Насколько полезен разбор?</div><div id="lbxStars" style="display:flex;justify-content:center;gap:7px;font-size:27px">'+[0,1,2,3,4].map(function(i){return '<span data-i="'+i+'" style="cursor:pointer;color:'+C.t2+'">★</span>';}).join('')+'</div><div id="lbxStarMsg" style="font-size:11px;color:'+C.pos+';margin-top:7px;height:14px"></div></div><div style="margin-top:14px;font-size:12px;color:'+C.t2+';font-style:italic">AI может ошибаться. Разбор поведения и риск-профиля, не инвестиционный совет.</div></div></div>';
    document.body.appendChild(o);o.querySelector('#lbxRvX').onclick=function(){o.remove();};o.onclick=function(e){if(e.target===o)o.remove();};
    var stars=o.querySelectorAll('#lbxStars span');function paint(k){for(var i=0;i<stars.length;i++)stars[i].style.color=i<=k?C.br:C.t2;}
    for(var si=0;si<stars.length;si++){(function(i){stars[i].onmouseenter=function(){paint(i);};stars[i].onclick=function(){r.rating=i+1;paint(i);o.querySelector('#lbxStarMsg').textContent='Спасибо за оценку! 🙏';};})(si);}
    o.querySelector('#lbxStars').onmouseleave=function(){paint((r.rating||0)-1);};if(r.rating)paint(r.rating-1);
  }
  function process(list){
    var fresh=list.filter(function(t){return !S.seen[t.ticket];}).sort(function(a,b){return a.closeTime-b.closeTime;});
    if(!fresh.length)return;
    fresh.forEach(function(t){S.seen[t.ticket]=1;S.newTrades.push(t);S.newCount++;var all=S.baseAll.concat(S.newTrades);var card=comment(t,all,S.newTrades);if(S.newCount%5===0)card.review=review(S.newTrades.slice(-5));else card.left=5-(S.newCount%5);S.cards.push(card);S.idx=S.cards.length-1;});
    elCnt.textContent='новых сделок: '+S.newCount;var pip=pill.querySelector('#lbxPip');if(pip)pip.textContent=S.newCount;render();
    var last=fresh[fresh.length-1],lp=pnl(last);toast((S.newCount%5===0?'🧠 Готов AI Trading Review 5 сделок! • ':'')+'Сделка '+sgn(lp)+' — '+last.alias,lp>=0?C.pos:C.neg);
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
  return 'v2.2 (GA-style review) injected; carried '+S.newCount+' trades';
})();
