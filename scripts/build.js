import { copyFileSync, cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

copyFileSync(join(root, 'index.html'), join(dist, 'index.html'));
cpSync(join(root, 'src'), join(dist, 'src'), { recursive: true });
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://ntwzgeanyyokfvvdnlcc.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const config = `window.PT_APP_CONFIG = {\n  supabaseUrl: '${supabaseUrl}',\n  supabaseAnonKey: '${supabaseAnonKey}',\n};\n`;
writeFileSync(join(dist, 'src', 'config.js'), config);
writeFileSync(join(dist, '.nojekyll'), '');

console.log('Built GitHub Pages site in dist/');
