// `npm start`: generates the content, then runs `ng serve` while watching
// content/portfolio.ttl, so saving the Turtle file reloads the page.
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const node = process.execPath;

if (spawnSync(node, ['scripts/build-content.mjs'], { stdio: 'inherit' }).status !== 0) process.exit(1);

const watcher = spawn(node, ['scripts/build-content.mjs', '--watch'], { stdio: 'inherit' });
const ng = spawn(node, [require.resolve('@angular/cli/bin/ng.js'), 'serve', ...process.argv.slice(2)], { stdio: 'inherit' });

const stop = () => {
  watcher.kill();
  ng.kill();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
ng.on('exit', (code) => {
  watcher.kill();
  process.exit(code ?? 0);
});
