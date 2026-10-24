// Generador estático sin dependencias: node build.js  ->  carpeta dist/
const fs=require('fs'),path=require('path');
const R=__dirname,D=path.join(R,'dist'),P=path.join(R,'posts'),S=path.join(R,'static');
const cfg=JSON.parse(fs.readFileSync(path.join(R,'site.json'),'utf8'));
const BASE=(cfg.url||(process.env.VERCEL_PROJECT_PRODUCTION_URL?'https://'+process.env.VERCEL_PROJECT_PRODUCTION_URL:'http://localhost:8000')).replace(/\/$/,'');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const MES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const fmt=d=>{const[y,m,x]=d.split('-');return `${+x} ${MES[m-1]} ${y}`};
const slugify=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const safeUrl=u=>/^\s*(javascript|data|vbscript):/i.test(u)?'#':u;
const imgUrl=u=>/^(https?:)?\/\//.test(u)||u[0]==='/'?safeUrl(u):'/images/'+u.replace(/^\.?\/?(images\/)?/,'');

function parseFM(raw){
  const m=raw.replace(/\r/g,'').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if(!m)return{meta:{},body:raw};
  const meta={};
  for(const l of m[1].split('\n')){
    const i=l.indexOf(':');if(i<0)continue;
    const k=l.slice(0,i).trim();let v=l.slice(i+1).trim();
    if(/^\[.*\]$/.test(v))v=v.slice(1,-1).split(',').map(x=>x.trim().replace(/^["']|["']$/g,'')).filter(Boolean);
    else if(v==='true'||v==='false')v=v==='true';
    else v=v.replace(/^["']|["']$/g,'');
    meta[k]=v;
  }
  return{meta,body:m[2]};
}

function inline(s){
  const codes=[];
  s=s.replace(/`([^`]+)`/g,(_,c)=>{codes.push(`<code>${esc(c)}</code>`);return `\u0000${codes.length-1}\u0000`});
  s=esc(s)
    .replace(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g,(_,f)=>`<img src="/images/${encodeURI(f.trim())}" alt="" loading="lazy">`)
    .replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g,(_,a,b)=>b||a)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g,(_,a,u)=>`<img src="${imgUrl(u)}" alt="${a}" loading="lazy">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,(_,t,u)=>`<a href="${safeUrl(u)}"${/^https?:/.test(u)?' target="_blank" rel="noopener"':''}>${t}</a>`)
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g,'$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g,'<del>$1</del>');
  return s.replace(/\u0000(\d+)\u0000/g,(_,i)=>codes[i]);
}

function md(src){
  const L=src.replace(/\r/g,'').split('\n'),o=[],para=[];let i=0;
  const flush=()=>{if(para.length){o.push(`<p>${inline(para.join(' '))}</p>`);para.length=0}};
  const lm=/^(\s*)([-*+]|\d+\.)\s+(.*)$/;
  while(i<L.length){
    const l=L[i];let m;
    if(m=l.match(/^```\s*([\w+-]*)/)){
      flush();const b=[];i++;
      while(i<L.length&&!/^```/.test(L[i]))b.push(L[i++]);
      i++;o.push(`<pre><code${m[1]?` class="language-${esc(m[1])}"`:''}>${esc(b.join('\n'))}</code></pre>`);continue;
    }
    if(!l.trim()){flush();i++;continue}
    if(m=l.match(/^(#{1,6})\s+(.*?)\s*#*$/)){flush();o.push(`<h${m[1].length} id="${slugify(m[2])}">${inline(m[2])}</h${m[1].length}>`);i++;continue}
    if(/^(-{3,}|\*{3,})\s*$/.test(l)){flush();o.push('<hr>');i++;continue}
    if(/^>/.test(l)){flush();const b=[];while(i<L.length&&/^>/.test(L[i]))b.push(L[i++].replace(/^>\s?/,''));o.push(`<blockquote>${md(b.join('\n'))}</blockquote>`);continue}
    if(m=l.match(lm)){
      flush();const base=m[1].length,tag=/\d/.test(m[2])?'ol':'ul',items=[];
      while(i<L.length){
        const x=L[i].match(lm);
        if(x&&x[1].length===base){items.push({t:x[3],sub:[]});i++}
        else if(L[i].trim()&&/^\s/.test(L[i])&&items.length){items[items.length-1].sub.push(L[i].slice(base+2));i++}
        else break;
      }
      o.push(`<${tag}>${items.map(it=>`<li>${inline(it.t)}${it.sub.length?md(it.sub.join('\n')):''}</li>`).join('')}</${tag}>`);continue;
    }
    if(l.includes('|')&&/^\s*\|?\s*:?-{2,}[-:| ]*$/.test(L[i+1]||'')){
      flush();const cells=r=>r.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim());
      const h=cells(l),rows=[];i+=2;
      while(i<L.length&&L[i].trim()&&L[i].includes('|'))rows.push(cells(L[i++]));
      o.push(`<div class="tw"><table><thead><tr>${h.map(c=>`<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);continue;
    }
    para.push(l.trim());i++;
  }
  flush();return o.join('\n');
}

// ---- posts ----
const inc=process.env.INCLUDE_DRAFTS==='1';
const posts=(fs.existsSync(P)?fs.readdirSync(P).filter(f=>f.endsWith('.md')):[]).map(f=>{
  const fp=path.join(P,f),{meta,body}=parseFM(fs.readFileSync(fp,'utf8')),slug=slugify(f.replace(/\.md$/,''));
  const date=/^\d{4}-\d{2}-\d{2}/.test(String(meta.date||''))?String(meta.date).slice(0,10):fs.statSync(fp).mtime.toISOString().slice(0,10);
  return{slug,date,title:meta.title||slug,description:meta.description||cfg.blogDescription,tags:Array.isArray(meta.tags)?meta.tags:[],author:meta.author||cfg.name,draft:meta.draft===true,html:md(body),min:Math.max(1,Math.round(body.split(/\s+/).length/200))};
}).filter(p=>inc||!p.draft).sort((a,b)=>b.date.localeCompare(a.date));

// ---- plantillas ----
const ICON='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0d1117"/><text x="4" y="22" font-family="monospace" font-size="16" font-weight="700" fill="#2dd4bf">&gt;_</text></svg>');
const nav=[['Sobre mí','/#sobre-mi'],['Proyectos','/#proyectos'],['Certificaciones','/#certificaciones'],['Blog','/blog/'],['Contacto','/#contacto']];
const page=(title,desc,p,article,content,extra='')=>`<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${BASE}${p}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="${article?'article':'website'}"><meta property="og:url" content="${BASE}${p}"><meta name="twitter:card" content="summary">
<link rel="alternate" type="application/rss+xml" title="RSS" href="/rss.xml"><link rel="icon" href="${ICON}">
<link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="/style.css"><script src="/theme.js"></script></head>
<body><header><div class="bar"><a class="logo" href="/"><i>~/</i>${esc(cfg.alias)}</a><nav>${nav.map(([t,h])=>`<a href="${h}">${t}</a>`).join('')}</nav><button id="theme" aria-label="Cambiar tema">◐</button></div></header>
<main>${content}</main><footer>© ${new Date().getFullYear()} ${esc(cfg.name)} · ${esc(cfg.alias)} · <a href="/rss.xml">RSS</a></footer>${extra}<script src="/main.js"></script></body></html>`;

const card=p=>`<article class="card"><span class="date">${fmt(p.date)} · ${p.min} min de lectura</span><h3><a href="/blog/${p.slug}/">${esc(p.title)}</a></h3><p>${esc(p.description)}</p><div>${p.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div><a class="more" href="/blog/${p.slug}/">Leer →</a></article>`;
const tagsOf=a=>a.map(t=>`<span class="tag">${esc(t)}</span>`).join('');
const [first,...rest]=cfg.name.split(' ');
const L=cfg.links||{};

const home=()=>page(`${cfg.name} (${cfg.alias}) | Ciberseguridad`,cfg.description,'/',false,`
<div class="hero" id="inicio"><div><div class="prompt">${esc(cfg.alias)}@sec:~$ whoami</div><h1>${esc(first)} <span>${esc(rest.join(' '))}</span><span class="cur"></span></h1><p class="sub">${esc(cfg.tagline)}</p><div class="cta"><a class="btn p" href="/#proyectos">Ver proyectos</a><a class="btn" href="/#contacto">Contacto</a></div></div>
<div class="term" role="img" aria-label="Resumen en formato terminal"><div class="top"><b></b><b></b><b></b></div><div class="body">${cfg.terminal.map(([c,o])=>`<span class="c">$ ${esc(c)}</span><span class="o">${esc(o)}</span>`).join('')}</div></div></div>
<section id="sobre-mi"><h2>Sobre mí</h2><p class="lead">Quién soy y qué estoy aprendiendo.</p>${cfg.about.map(t=>`<p>${esc(t)}</p>`).join('')}<div class="stats">${cfg.stats.map(s=>`<div class="stat"><b>${esc(s.title)}</b>${esc(s.label)}</div>`).join('')}</div></section>
<section id="proyectos"><h2>Proyectos</h2><p class="lead">Herramientas que desarrollé para aprender y automatizar.</p><div class="grid">${cfg.projects.map(p=>`<article class="card"><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p><div>${tagsOf(p.tags||[])}</div>${p.url?`<a class="more" href="${esc(p.url)}" target="_blank" rel="noopener">Ver en GitHub →</a>`:'<span class="date">Enlace próximamente</span>'}</article>`).join('')}</div></section>
<section id="certificaciones"><h2>Certificaciones</h2><p class="lead">Credenciales y formación en curso.</p><div class="grid">${cfg.certifications.map(c=>`<article class="card"><h3>${esc(c.title)}</h3><p>${esc(c.description)}</p><div>${tagsOf([c.tag])}</div></article>`).join('')}</div></section>
<section id="blog"><h2>Blog</h2><p class="lead">${esc(cfg.blogDescription)}</p>${posts.length?`<div class="grid">${posts.slice(0,3).map(card).join('')}</div>`:'<p class="lead">Pronto habrá posts.</p>'}<p class="mt"><a class="btn" href="/blog/">/blog · ver todos →</a></p></section>
<section id="contacto"><h2>Contacto</h2><p class="lead">Para consultas, colaboraciones o simplemente conectar.</p><div class="links">${L.github?`<a class="btn" href="${esc(L.github)}" target="_blank" rel="noopener">GitHub</a>`:''}${L.linkedin?`<a class="btn" href="${esc(L.linkedin)}" target="_blank" rel="noopener">LinkedIn</a>`:''}${L.email?`<a class="btn" href="mailto:${esc(L.email)}">${esc(L.email)}</a>`:''}</div></section>`);

const blogIndex=()=>page(`Blog | ${cfg.name}`,cfg.blogDescription,'/blog/',false,`<section class="top"><h1>Blog</h1><p class="lead">${esc(cfg.blogDescription)} <a class="more" href="/rss.xml">RSS</a></p>${posts.length?`<div class="grid">${posts.map(card).join('')}</div>`:'<p>Todavía no hay posts.</p>'}</section>`);

const postPage=p=>page(`${p.title} | ${cfg.name}`,p.description,`/blog/${p.slug}/`,true,`<article class="post"><a class="more" href="/blog/">← Todos los posts</a><h1>${esc(p.title)}</h1><div class="meta"><span class="date">${fmt(p.date)} · ${p.min} min de lectura · ${esc(p.author)}</span><div>${tagsOf(p.tags)}</div></div><div class="prose">${p.html}</div></article>`,'<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>');

// ---- salida ----
fs.rmSync(D,{recursive:true,force:true});
const w=(f,c)=>{const t=path.join(D,f);fs.mkdirSync(path.dirname(t),{recursive:true});fs.writeFileSync(t,c)};
if(fs.existsSync(S))fs.cpSync(S,D,{recursive:true});
w('index.html',home());w('blog/index.html',blogIndex());
posts.forEach(p=>w(`blog/${p.slug}/index.html`,postPage(p)));
w('404.html',page(`404 | ${cfg.name}`,'Página no encontrada','/404.html',false,'<section class="top"><h1>404</h1><p class="lead">Esta página no existe.</p><a class="btn" href="/">Volver al inicio</a></section>'));
w('rss.xml',`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(cfg.name)}</title><link>${BASE}/blog/</link><description>${esc(cfg.blogDescription)}</description><language>es</language>${posts.map(p=>`<item><title>${esc(p.title)}</title><link>${BASE}/blog/${p.slug}/</link><guid>${BASE}/blog/${p.slug}/</guid><pubDate>${new Date(p.date+'T12:00:00Z').toUTCString()}</pubDate><description>${esc(p.description)}</description></item>`).join('')}</channel></rss>`);
w('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/','/blog/',...posts.map(p=>`/blog/${p.slug}/`)].map(u=>`<url><loc>${BASE}${u}</loc></url>`).join('')}</urlset>`);
w('robots.txt',`User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`);
console.log(`OK: ${posts.length} post(s) -> dist/`);
