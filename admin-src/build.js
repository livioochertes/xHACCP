import { build } from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('Building admin bundle...');

await build({
  entryPoints: [resolve(__dirname, 'AdminApp.jsx')],
  bundle: true,
  outfile: resolve(__dirname, '../admin/vendor/admin-bundle.js'),
  platform: 'browser',
  format: 'iife',
  jsx: 'automatic',
  jsxImportSource: 'react',
  minify: false,
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  loader: {
    '.json': 'json',
    '.jsx': 'jsx',
    '.js': 'jsx',
  },
});

console.log('✅ Admin bundle built → admin/vendor/admin-bundle.js');
