import fs from 'node:fs';
import path from 'node:path';

fs.mkdirSync('dist/renderer', { recursive: true });
for (const file of ['index.html', 'styles.css']) {
  fs.copyFileSync(path.join('src/renderer', file), path.join('dist/renderer', file));
}
