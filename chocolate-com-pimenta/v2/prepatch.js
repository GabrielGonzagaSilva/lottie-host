(function(){'use strict';
/*
  The facilitator dashboard refreshes frequently. Native <select> menus were
  previously being replaced while the user was choosing a team, which made
  Equipe A/B assignment look unreliable. This guard freezes only the
  participant list DOM while a team selector is actively open/focused.
*/
let selecting=false;
let releaseTimer=null;
const descriptor=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
if(descriptor&&descriptor.get&&descriptor.set){
  Object.defineProperty(Element.prototype,'innerHTML',{
    configurable:true,
    enumerable:descriptor.enumerable,
    get(){return descriptor.get.call(this)},
    set(value){
      if(this.id==='participants'&&selecting&&this.contains(document.activeElement))return value;
      return descriptor.set.call(this,value);
    }
  });
}
function hold(){selecting=true;clearTimeout(releaseTimer);releaseTimer=setTimeout(()=>{selecting=false},4000)}
function release(){clearTimeout(releaseTimer);releaseTimer=setTimeout(()=>{selecting=false},180)}
document.addEventListener('pointerdown',e=>{if(e.target&&e.target.matches&&e.target.matches('[data-team-select]'))hold()},true);
document.addEventListener('focusin',e=>{if(e.target&&e.target.matches&&e.target.matches('[data-team-select]'))hold()},true);
document.addEventListener('change',e=>{if(e.target&&e.target.matches&&e.target.matches('[data-team-select]'))release()},true);
document.addEventListener('focusout',e=>{if(e.target&&e.target.matches&&e.target.matches('[data-team-select]'))release()},true);
})();
