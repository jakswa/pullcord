// Inline JS — zero external requests. Handles polling + freshness everywhere,
// plus (on the landing page) projecting the hidden source station list into
// favorite hero cards, a geo "nearby" list, and a searchable all-stations list.
export function buildInlineJS(isLanding: boolean): string {
  // Base: poll the page's own ?partial=1 and swap #rail-data, tick freshness.
  const base = `(function(){var P=1e4,d=document.getElementById("rail-data"),f=document.getElementById("freshness");if(!d||!f)return;var t=Date.now(),p=null,b=window.location.pathname;function u(){var a=Math.floor((Date.now()-t)/1e3);f.textContent=a<2?"live":a+"s";f.style.color=a>30?"var(--accent)":""}setInterval(u,1e3);u();function q(){fetch(b+"?partial=1",{signal:AbortSignal.timeout(8e3)}).then(function(r){if(r.ok)return r.text()}).then(function(h){if(h){d.innerHTML=h;t=Date.now();u();typeof reorder==="function"&&reorder();typeof postUpdate==="function"&&postUpdate()}}).catch(function(){})}p=setInterval(q,P);document.addEventListener("visibilitychange",function(){if(document.hidden){clearInterval(p);p=null}else{q();p=setInterval(q,P)}})})();`;

  if (!isLanding) return base;

  // Landing: favorites → heroes, nearby (geo opt-in), searchable all-stations.
  const landing = `
(function(){
var SK="rail-starred",coords=window.__COORDS||{},LC=window.__LC||{};
var DORD=["N","S","E","W"],ARROW={N:"\\u2191",S:"\\u2193",E:"\\u2192",W:"\\u2190"};

function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function col(l){return LC[l]||"#666"}
function getStarred(){try{return JSON.parse(localStorage.getItem(SK))||[]}catch(e){return[]}}
function setStarred(a){localStorage.setItem(SK,JSON.stringify(a))}
function toggleStar(slug){var s=getStarred(),i=s.indexOf(slug);if(i>-1)s.splice(i,1);else s.push(slug);setStarred(s);reorder()}
function eState(eta,rt){if(eta<60)return{k:"now"};var m=Math.max(1,Math.round(eta/60));return{k:rt?"min":"approx",m:m}}

var STAR='<svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.3L12 17.1l-5.7 3.1 1.2-6.3L2.8 9.5l6.4-.8L12 2.8z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
var STAR_O='<svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.3L12 17.1l-5.7 3.1 1.2-6.3L2.8 9.5l6.4-.8L12 2.8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
var PIN='<svg width="12" height="12" viewBox="0 0 24 24"><path d="M12 21s7-5.8 7-11a7 7 0 1 0-14 0c0 5.2 7 11 7 11z" fill="currentColor"/></svg>';
var LOC='<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="2"/><path d="M12 21s7-5.8 7-11a7 7 0 1 0-14 0c0 5.2 7 11 7 11z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';

function bigtime(a){var s=eState(a.eta,a.rt);if(s.k==="now")return '<span class="rail-bigtime mono is-now" style="color:'+col(a.line)+'">now</span>';return '<span class="rail-bigtime mono'+(s.k==="approx"?" is-approx":"")+'">'+(s.k==="approx"?"<i>~</i>":"")+"<span>"+s.m+"</span><em>min</em></span>"}
function thenStr(list){if(list.length<2)return "";var parts=list.slice(1,3).map(function(a){var s=eState(a.eta,a.rt);return s.k==="now"?"now":s.m});return '<span class="rail-herodir-then mono">then '+parts.join(" \\u00b7 ")+"</span>"}
function chip(line){return '<span class="rail-chip rail-chip-sm mono" style="background:'+col(line)+'">'+esc(line.toLowerCase())+"</span>"}
function herodir(d,list){var a=list[0];return '<div class="rail-herodir"><div class="rail-herodir-route mono"><b>'+ARROW[d]+"</b> "+esc(a.dest.toLowerCase())+"</div>"+bigtime(a)+'<div class="rail-herodir-meta">'+chip(a.line)+thenStr(list)+"</div></div>"}
function heroHTML(slug,data){var dirs=DORD.filter(function(d){return data.dirs[d]&&data.dirs[d].length});var quad=dirs.length>2;var grid=dirs.map(function(d){return herodir(d,data.dirs[d])}).join("");return '<a class="rail-hero" href="/rail/'+slug+'"><div class="rail-hero-eyebrow mono">'+PIN+' your station</div><span class="rail-hero-star" role="button" aria-label="Unfavorite" data-slug="'+slug+'">'+STAR+'</span><h2 class="rail-hero-name">'+esc(data.name)+'</h2><div class="rail-hero-grid'+(quad?" is-quad":"")+'">'+grid+'</div><div class="rail-hero-foot mono">tap for full board \\u2197</div></a>'}
function emptyHeroHTML(){return '<div class="rail-hero-empty"><div class="rail-hero-empty-star">\\u2606</div><div class="rail-hero-empty-title">no pinned stations yet</div><div class="rail-hero-empty-sub">tap the star on any station below to pin it here for one-glance departures.</div></div>'}

function makeListRow(src){
  var c=src.cloneNode(true);
  var slug=c.getAttribute("data-slug"),starred=getStarred().indexOf(slug)>-1;
  var star=document.createElement("span");
  star.className="rail-star"+(starred?" starred":"");
  star.setAttribute("role","button");
  star.setAttribute("aria-label",starred?"Unfavorite":"Favorite");
  star.innerHTML=starred?STAR:STAR_O;
  star.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();toggleStar(slug)});
  c.insertBefore(star,c.firstChild);
  return c;
}

// ── geolocation (nearby) ──
var userPos=null,geoRequested=false,geoDenied=false,GEO_KEY="rail-geo";
try{var cached=JSON.parse(sessionStorage.getItem(GEO_KEY));if(cached&&Date.now()-cached.ts<300000)userPos=[cached.lat,cached.lng]}catch(e){}
// Haversine km — proximity sort only, never displayed as distance (issue #68).
function dist(a,b){var R=6371,dLat=(b[0]-a[0])*Math.PI/180,dLon=(b[1]-a[1])*Math.PI/180;var x=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(a[0]*Math.PI/180)*Math.cos(b[0]*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
function requestGeo(){
  if(!navigator.geolocation)return;
  geoDenied=false;geoRequested=true;reorder();
  navigator.geolocation.getCurrentPosition(function(p){
    userPos=[p.coords.latitude,p.coords.longitude];
    try{sessionStorage.setItem(GEO_KEY,JSON.stringify({lat:userPos[0],lng:userPos[1],ts:Date.now()}))}catch(e){}
    reorder();
  },function(){geoRequested=false;geoDenied=true;reorder()},{maximumAge:120000,timeout:8000});
}

function buildNearby(rows,starredSet){
  var sect=document.getElementById("rail-nearby-sect"),box=document.getElementById("rail-nearby-rows");
  if(!sect||!box)return;
  if(!navigator.geolocation){sect.hidden=true;return}
  sect.hidden=false;
  if(userPos){
    var near=rows.map(function(r){var s=r.getAttribute("data-slug"),c=coords[s];return{r:r,s:s,d:c?dist(userPos,c):1e9}})
      .filter(function(x){return!starredSet.has(x.s)}).sort(function(a,b){return a.d-b.d}).slice(0,3);
    if(!near.length){sect.hidden=true;return}
    box.innerHTML="";
    near.forEach(function(x){box.appendChild(makeListRow(x.r))});
    return;
  }
  if(geoRequested&&!geoDenied){box.innerHTML='<div class="rail-skel-row"></div><div class="rail-skel-row"></div><div class="rail-skel-row"></div>';return}
  box.innerHTML="";
  var b=document.createElement("button");
  b.className="rail-geo-prompt";b.type="button";
  b.innerHTML=LOC+"<span>"+(geoDenied?"location blocked \\u2014 tap to retry":"show stations near me")+"</span>";
  b.addEventListener("click",requestGeo);
  box.appendChild(b);
}

// ── search ──
function applySearch(){
  var inp=document.getElementById("rail-q"),box=document.getElementById("rail-all-rows");
  if(!inp||!box)return;
  var q=(inp.value||"").trim().toLowerCase(),x=document.getElementById("rail-q-x");
  if(x)x.hidden=!q;
  var any=false,rows=box.querySelectorAll(".rail-row");
  rows.forEach(function(r){var n=r.querySelector(".rail-row-name"),name=n?n.textContent.toLowerCase():"";var show=!q||name.indexOf(q)>-1;r.hidden=!show;if(show)any=true});
  var none=document.getElementById("rail-all-none");
  if(!any&&q){if(!none){none=document.createElement("div");none.id="rail-all-none";none.className="rail-row-empty";box.appendChild(none)}none.textContent='no stations match \\u201c'+q+'\\u201d';none.hidden=false}
  else if(none){none.hidden=true}
}

// ── main projection (runs on load + after every poll) ──
window.reorder=function(){
  var src=document.querySelector("#rail-data .rail-station-list");
  if(!src)return;
  var rows=Array.prototype.slice.call(src.querySelectorAll(".rail-row"));
  var bySlug={};rows.forEach(function(r){bySlug[r.getAttribute("data-slug")]=r});
  var starred=getStarred(),starredSet={};starred.forEach(function(s){starredSet[s]=1});

  // heroes
  var hc=document.getElementById("rail-heroes");
  var present=starred.filter(function(s){return bySlug[s]});
  hc.innerHTML=present.length?present.map(function(s){return heroHTML(s,JSON.parse(bySlug[s].getAttribute("data-arr")))}).join(""):emptyHeroHTML();
  Array.prototype.forEach.call(hc.querySelectorAll(".rail-hero-star"),function(b){b.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();toggleStar(b.getAttribute("data-slug"))})});

  // nearby
  buildNearby(rows,{has:function(s){return!!starredSet[s]}});

  // all stations (excluding pinned)
  var box=document.getElementById("rail-all-rows");
  box.innerHTML="";
  rows.forEach(function(r){if(starredSet[r.getAttribute("data-slug")])return;box.appendChild(makeListRow(r))});
  applySearch();
};

// wire search once (input lives outside #rail-data so it survives polls)
var qi=document.getElementById("rail-q"),qx=document.getElementById("rail-q-x");
if(qi)qi.addEventListener("input",applySearch);
if(qx)qx.addEventListener("click",function(){qi.value="";applySearch();qi.focus()});

// If location permission is already granted, skip the tap-to-expand and fetch
// straight away (survives new tabs / cache expiry, where sessionStorage is empty).
if(navigator.permissions&&navigator.permissions.query){
  navigator.permissions.query({name:"geolocation"}).then(function(st){
    function maybe(){if(st.state==="granted"&&!userPos&&!geoRequested)requestGeo()}
    maybe();st.onchange=maybe;
  }).catch(function(){});
}

reorder();
})();`;

  return base + landing;
}
