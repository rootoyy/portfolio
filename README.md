# Portfolio de rootoy

Sitio estático sin dependencias. `node build.js` genera la carpeta `dist/`.

- Datos de la página (about, proyectos, certificaciones, links): `site.json`
- Posts: archivos `.md` en `posts/` (con frontmatter: title, date, description, tags, author, draft)
- Imágenes de posts: `static/images/` (se usan como `![alt](images/foto.png)`)
- Vista previa local (incluye borradores): `npm run dev` y abrir http://localhost:8000
- Si tenés dominio propio, poné su URL en el campo `url` de `site.json` (para RSS y sitemap)
