// Serveur local du laboratoire : sert le dossier site/ sur http://localhost:8000.
// Aucune dépendance : seul Node.js est nécessaire.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./site/', import.meta.url)));
const portArg = process.argv.indexOf('--port');
const port = Number(portArg > -1 ? process.argv[portArg + 1] : process.env.PORT || 8000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Port invalide. Exemple : npm run dev -- --port 8001');
  process.exit(1);
}

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

const server = createServer(async (request, response) => {
  const send = (status, body, type = 'text/plain; charset=utf-8') => {
    response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : body);
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') return send(405, 'Méthode non autorisée');
  let path;
  try { path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { return send(400, 'Adresse invalide'); }
  if (path.endsWith('/')) path += 'index.html';
  // Empêche de sortir du dossier site/.
  const file = normalize(join(root, path));
  if (file !== root && !file.startsWith(root + sep)) return send(403, 'Accès refusé');
  try {
    if (!(await stat(file)).isFile()) return send(404, 'Introuvable');
    send(200, await readFile(file), types[extname(file).toLowerCase()] || 'application/octet-stream');
  } catch {
    send(404, 'Introuvable');
  }
});

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\nLe port ${port} est déjà utilisé : le laboratoire tourne peut-être déjà dans un autre terminal.`);
    console.error('Fermez cet autre terminal, ou choisissez un autre port : npm run dev -- --port 8001\n');
  } else {
    console.error(error.message);
  }
  process.exit(1);
});

server.listen(port, '127.0.0.1', () => {
  console.log('\n  Blockchain sécurité · Le laboratoire');
  console.log(`  Ouvrez http://localhost:${port} dans le navigateur où MetaMask est installé.`);
  console.log('  Laissez ce terminal ouvert pendant la séance. Pour arrêter : Ctrl + C\n');
});
