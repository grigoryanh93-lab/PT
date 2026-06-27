import { copyFileSync, cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

copyFileSync(join(root, 'index.html'), join(dist, 'index.html'));
cpSync(join(root, 'src'), join(dist, 'src'), { recursive: true });
writeFileSync(join(dist, '.nojekyll'), '');

console.log('Built GitHub Pages site in dist/');
