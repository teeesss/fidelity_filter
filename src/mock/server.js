import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 59981;

const server = http.createServer((req, res) => {
  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = './Portfolio Positions.html';
  } else {
    filePath = decodeURIComponent(filePath);
  }

  // Handle path traversal safety (case-insensitive for Windows)
  const resolvedPath = path.resolve(filePath).toLowerCase();
  const rootPath = path.resolve('.').toLowerCase();
  if (!resolvedPath.startsWith(rootPath)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server error: ' + err.code);
      }
    } else {
      let contentType = 'text/html';
      if (filePath.endsWith('.js') || filePath.endsWith('.js.download')) {
        contentType = 'application/javascript';
      } else if (filePath.endsWith('.css')) {
        contentType = 'text/css';
      } else if (filePath.endsWith('.svg')) {
        contentType = 'image/svg+xml';
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Debug server running at http://localhost:${PORT}/`);
});
