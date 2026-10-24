var b=document.getElementById('theme');
if(b)b.onclick=function(){var r=document.documentElement,n=getComputedStyle(r).colorScheme==='light'?'dark':'light';r.dataset.theme=n;try{localStorage.setItem('theme',n)}catch(e){}};
if(window.hljs)hljs.highlightAll();
