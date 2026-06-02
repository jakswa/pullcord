// Inline JS — zero external requests, handles polling + starred/nearby reordering
export function buildInlineJS(isLanding: boolean): string {
  const base = `(function(){var P=1e4,d=document.getElementById("rail-data"),f=document.getElementById("freshness");if(!d||!f)return;var t=Date.now(),p=null,b=window.location.pathname;function u(){var a=Math.floor((Date.now()-t)/1e3);f.textContent=a<2?"live":a+"s ago";f.style.color=a>30?"#E85D3A":""}setInterval(u,1e3);u();function q(){fetch(b+"?partial=1",{signal:AbortSignal.timeout(8e3)}).then(function(r){if(r.ok)return r.text()}).then(function(h){if(h){d.innerHTML=h;t=Date.now();u();typeof reorder==="function"&&reorder();typeof postUpdate==="function"&&postUpdate()}}).catch(function(){})}p=setInterval(q,P);document.addEventListener("visibilitychange",function(){if(document.hidden){clearInterval(p);p=null}else{q();p=setInterval(q,P)}})})();`;

  if (!isLanding) return base;

  // Landing page: starred, nearby (opt-in geo), collapsible sections
  const landing = `
(function(){
var SK="rail-starred",SEC="rail-sections",coords=window.__COORDS||{};
function getStarred(){try{return JSON.parse(localStorage.getItem(SK))||[]}catch(e){return[]}}
function setStarred(a){localStorage.setItem(SK,JSON.stringify(a))}
function toggleStar(slug){var s=getStarred(),i=s.indexOf(slug);if(i>-1)s.splice(i,1);else s.push(slug);setStarred(s);reorder()}
function getSections(){try{return JSON.parse(localStorage.getItem(SEC))||{}}catch(e){return{}}}
function setSections(o){localStorage.setItem(SEC,JSON.stringify(o))}

// Haversine in km
function dist(a,b){var R=6371,dLat=(b[0]-a[0])*Math.PI/180,dLon=(b[1]-a[1])*Math.PI/180;var x=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(a[0]*Math.PI/180)*Math.cos(b[0]*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}

var userPos=null,geoRequested=false,GEO_KEY="rail-geo";

// Restore cached position immediately
try{var cached=JSON.parse(sessionStorage.getItem(GEO_KEY));if(cached&&Date.now()-cached.ts<300000)userPos=[cached.lat,cached.lng]}catch(e){}

function requestGeo(){
  if(!navigator.geolocation)return;
  // Use cached position immediately, refresh in background
  if(userPos){reorder();if(geoRequested)return}
  geoRequested=true;
  navigator.geolocation.getCurrentPosition(function(p){
    userPos=[p.coords.latitude,p.coords.longitude];
    try{sessionStorage.setItem(GEO_KEY,JSON.stringify({lat:userPos[0],lng:userPos[1],ts:Date.now()}))}catch(e){}
    reorder();
  },function(err){
    geoRequested=false;
    var s=getSections();s.nearby=false;setSections(s);reorder();
  },{ maximumAge:120000,timeout:8000 });
}

function getSlug(row){var h=row.getAttribute("href");return h?h.replace("/rail/",""):""}

function isOpen(key,def){var s=getSections();return s.hasOwnProperty(key)?s[key]:def}
function toggleSection(key){var s=getSections();s[key]=!isOpen(key,key!=="nearby");setSections(s);if(key==="nearby"&&s[key])requestGeo();reorder()}

window.reorder=function(){
  var list=document.querySelector(".rail-station-list");
  if(!list)return;
  list.classList.remove("rail-loading");
  var rows=Array.from(list.querySelectorAll(".rail-row:not([data-clone])"));
  var starred=getStarred();

  // Remove old sections/stars
  list.querySelectorAll(".rail-section,.rail-section-items").forEach(function(el){el.remove()});
  rows.forEach(function(row){
    var old=row.querySelector(".rail-star");if(old)old.remove();
    var slug=getSlug(row);
    var btn=document.createElement("span");
    btn.className="rail-star"+(starred.indexOf(slug)>-1?" starred":"");
    btn.textContent=starred.indexOf(slug)>-1?"\\u2605":"\\u2606";
    btn.setAttribute("role","button");
    btn.setAttribute("aria-label",starred.indexOf(slug)>-1?"Unstar":"Star");
    btn.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();toggleStar(slug)});
    row.insertBefore(btn,row.firstChild);
  });

  var starredSet=new Set(starred);

  // Compute nearby (top 3 non-starred, sorted by distance)
  var nearby=[];
  if(userPos){
    var dists=rows.map(function(r){var s=getSlug(r);var c=coords[s];return{slug:s,d:c?dist(userPos,c):999}}).filter(function(x){return!starredSet.has(x.slug)}).sort(function(a,b){return a.d-b.d});
    nearby=dists.slice(0,3).map(function(x){return x.slug});
  }

  var nearbySet=new Set(nearby);
  var starredRows=[],nearbyRows=[],allRows=[];
  rows.forEach(function(r){
    var s=getSlug(r);
    if(starredSet.has(s))starredRows.push(r);
    else if(nearbySet.has(s))nearbyRows.push(r);
    allRows.push(r);
  });

  while(list.firstChild)list.removeChild(list.firstChild);

  function cloneRow(r){
    var s=getSlug(r);
    var c=r.cloneNode(true);
    c.setAttribute("data-clone","1");
    var btn=c.querySelector(".rail-star");
    if(btn)btn.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();toggleStar(s)});
    return c;
  }

  function addSection(key,label,items,defaultOpen,cloneItems){
    var open=isOpen(key,defaultOpen);
    var hasItems=items.length>0;
    // nearby always shows as a section (it's the geo opt-in)
    if(!hasItems&&key!=="nearby")return;

    var h=document.createElement("div");
    h.className="rail-section"+(open?" open":"");
    h.setAttribute("role","button");
    h.setAttribute("aria-expanded",open?"true":"false");

    var txt=document.createElement("span");
    txt.textContent=label;
    h.appendChild(txt);

    var toggle=document.createElement("span");
    toggle.className="rail-toggle"+(open?" on":"");
    var knob=document.createElement("span");
    knob.className="rail-toggle-knob";
    toggle.appendChild(knob);
    h.appendChild(toggle);

    h.addEventListener("click",function(){toggleSection(key)});
    list.appendChild(h);

    if(hasItems){
      var wrap=document.createElement("div");
      wrap.className="rail-section-items";
      if(!open)wrap.style.display="none";
      items.forEach(function(r){wrap.appendChild(cloneItems?cloneRow(r):r)});
      list.appendChild(wrap);
    } else if(key==="nearby"&&open&&!userPos){
      // Skeleton while waiting for geolocation
      var skel=document.createElement("div");
      skel.className="rail-section-items rail-skeleton";
      for(var i=0;i<3;i++){var row=document.createElement("div");row.className="rail-skel-row";skel.appendChild(row)}
      list.appendChild(skel);
    }
  }

  var hasAnySections=starredRows.length>0||navigator.geolocation;
  if(hasAnySections){
    addSection("starred","starred",starredRows,true,true);
    if(navigator.geolocation)addSection("nearby","nearby",nearbyRows,false,true);
    addSection("all","all stations",allRows,true,false);
  } else {
    allRows.forEach(function(r){list.appendChild(r)});
  }
};
// If user previously enabled nearby, silently re-request geo on load
if(isOpen("nearby",false))requestGeo();
reorder();
})();`;

  return base + landing;
}
