import React, {useCallback, useEffect, useRef, useState} from 'react';

const secrets={
 star:{theme:'starlight',symbol:'✧',label:'МАЛЕНЬКОЕ СОЗВЕЗДИЕ',title:'Из всех звёзд — ты.',text:'Если бы я мог оставить одно желание на небе, оно было бы простым: пусть у тебя сегодня будет повод улыбнуться.',after:'Вот и первый. Это маленькое небо — тебе.'},
 letter:{theme:'secret-letter',symbol:'♡',label:'ПИСЬМО МЕЖДУ СТРОК',title:'Ещё кое-что…',text:'Этот конверт оказался чуть больше, чем кажется. Здесь поместилось то, что я не всегда умею сказать вслух: ты для меня очень особенная.',after:'Даже в самых маленьких деталях здесь — ты.'},
 eyes:{theme:'meadow',symbol:'❋',label:'ТАМ, ГДЕ СТАНОВИТСЯ ТЕПЛЕЕ',title:'Я снова потерялся.',text:'Кажется, в твоих зелёных глазах есть своя маленькая весна. Посмотришь — и даже самый обычный день становится немного светлее.',after:'Пусть это нежное свечение напомнит тебе об этом.'},
 hug:{theme:'warm-hug',symbol:'♡',label:'ОБЪЯТИЕ НА РАССТОЯНИИ',title:'Побудь здесь секунду.',text:'Представь, что я сейчас рядом. Никуда не тороплюсь, ничего не говорю — просто крепко тебя обнимаю.',after:'Можно возвращаться сюда за объятиями сколько захочешь.'}
};

export function useSurprises(){
 const [secret,setSecret]=useState(null),[found,setFound]=useState(()=>new Set());
 const foundRef=useRef(new Set()),pendingGrand=useRef(false);
 const discover=useCallback(id=>{
  if(!secrets[id])return;
  const fresh=!foundRef.current.has(id);foundRef.current.add(id);setFound(new Set(foundRef.current));
  if(fresh&&foundRef.current.size===4)pendingGrand.current=true;
  setSecret(id);
 },[]);
 const dismiss=useCallback(()=>{
  if(pendingGrand.current){pendingGrand.current=false;setSecret('grand')}else setSecret(null);
 },[]);
 const showGrand=()=>{pendingGrand.current=false;setSecret('grand')};
 return {discover,
  guide:<div className="hunt-invite"><span aria-hidden="true">✧</span><p>Пс-с… здесь спрятаны четыре маленьких сюрприза.<br/>Касайся мерцающих деталей. В конце тебя ждёт кое-что особенное.</p><small>Найдено {found.size} из 4</small>{found.size===4&&<button type="button" onClick={showGrand}>Открыть главный сюрприз ещё раз ♡</button>}</div>,
  dialog:<SurpriseDialog id={secret} count={found.size} dismiss={dismiss} showGrand={showGrand}/>
 };
}

function SurpriseDialog({id,count,dismiss,showGrand}){
 const ref=useRef(null),opener=useRef(null);const secret=id==='grand'?{theme:'grand-finale',label:'САМОЕ ВАЖНОЕ БЫЛО ЗДЕСЬ ВСЁ ЭТО ВРЕМЯ'}:secrets[id];
 useEffect(()=>{
  const dialog=ref.current;
  if(!id){if(dialog.open)dialog.close();return}
  opener.current=document.activeElement;
  const oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  if(!dialog.open)dialog.showModal();
  dialog.scrollTop=0;dialog.querySelector('.secret-close')?.focus({preventScroll:true});
  return()=>{document.body.style.overflow=oldOverflow;opener.current?.focus?.({preventScroll:true})};
 },[id]);
 return <dialog ref={ref} className={'secret-dialog '+(secret?.theme||'')} aria-labelledby="secret-title" aria-describedby="secret-text" onClose={dismiss} onClick={event=>{if(event.target===event.currentTarget){const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dismiss()}}}>
  {secret&&<div className="secret-content" key={id}>
   <button type="button" className="secret-close" onClick={dismiss} aria-label="Закрыть сюрприз">×</button>
   {id==='grand'?<GrandSurprise dismiss={dismiss}/>:<>
   <div className="secret-art" aria-hidden="true">
    {id==='star'?<svg viewBox="0 0 300 145"><path className="constellation-line" d="M35 100 85 39 147 77 209 28 266 96"/><g className="constellation-stars"><text x="23" y="114">✧</text><text x="73" y="53">✦</text><text x="135" y="91">✧</text><text x="197" y="42">✦</text><text x="254" y="110">✧</text></g></svg>:<><span className="secret-orbit orbit-one"/><span className="secret-orbit orbit-two"/><span className="secret-center">{secret.symbol}</span>{Array.from({length:7},(_,i)=><span key={i} className="secret-spark" style={{'--angle':`${i*360/7}deg`,'--delay':`${i*.13}s`}}>{id==='eyes'?'✿':'✧'}</span>)}</>}
   </div>
   <p className="secret-label">{secret.label}</p>
   <h2 id="secret-title">{secret.title}</h2>
   <p id="secret-text" className="secret-text">{secret.text}</p><p className="secret-after">{secret.after}</p>
   <p className="secret-progress">Найдено {count} из 4 маленьких секретов.<br/>{count===4?'Ты собрала их все. Теперь можно открыть самое главное.':'Кажется, кое-что ещё прячется среди украшений…'}</p>
   <button type="button" className="primary secret-return" onClick={count===4?showGrand:dismiss}>{count===4?'Открыть главный сюрприз ✧':'Сохранить улыбку ♡'}</button></>}

  </div>}
 </dialog>;
}

function GrandSurprise({dismiss}){
 return <div className="grand-reveal">
  <div className="grand-sky" aria-hidden="true">{Array.from({length:15},(_,i)=><span key={i} style={{'--left':`${6+(i*37)%89}%`,'--top':`${4+(i*23)%87}%`,'--delay':`${i*.16}s`}}>{i%3?'✧':'♡'}</span>)}<div className="grand-aura"/><span className="grand-heart">♡</span></div>
  <p className="secret-label">ВСЕ МАЛЕНЬКИЕ СЕКРЕТЫ ВЕЛИ СЮДА</p>
  <h2 id="secret-title">Ты нашла<br/><em>главный сюрприз.</em></h2>
  <div id="secret-text" className="grand-letter"><p>Викуська, я спрятал здесь звёзды, тёплые слова и объятия. Но самое большое чувство невозможно уместить ни в одну тайную кнопку.</p><p>Мне хочется, чтобы ты знала: тебе не нужно быть какой-то особенной версией себя, чтобы быть мне дорогой. Можно смеяться, грустить, молчать, рассказывать о своём дне — мне важна именно <em>ты.</em></p><p>Твои зелёные глаза — мой любимый повод потеряться. А твоя улыбка — причина, по которой мне захотелось придумать весь этот маленький мир.</p><p>И если после всех этих секретов ты хотя бы на секунду почувствуешь, как нежно я к тебе отношусь, значит, всё получилось.</p></div>
  <p className="grand-promise">Все эти маленькие секреты — способ сказать,<br/>как много в моём сердце <em>тебя.</em></p>
  <div className="grand-love" aria-label="Я тебя люблю">Я тебя <span>люблю.</span></div>
  <p className="grand-signature">Без загадок. Без спрятанных смыслов.<br/>Просто ты. И это чувство. ♡</p>
  <button type="button" className="primary" onClick={dismiss}>Забрать это тепло с собой ♡</button>
 </div>;
}
