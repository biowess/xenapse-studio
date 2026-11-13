/* Apply stored theme and settings before first paint */
(function(){try{var p=JSON.parse(localStorage.getItem('xenapse.prefs.v1')||'{}'),h=document.documentElement,t=p.theme||'light';
if(t==='system')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
h.dataset.theme=t;if(p.density)h.dataset.density=p.density;
var darkThemes=['dark','loto-dark','plum-midnight','nightshade','northwind','mocha','forest-dark','ocean-deep','burgundy-dark','amber-terminal','carbon','high-contrast-dark'];
if(darkThemes.indexOf(t)!==-1){h.style.colorScheme='dark';}else{h.style.colorScheme='light';}
}catch(e){}})();
