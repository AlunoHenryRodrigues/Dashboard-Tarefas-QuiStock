import {execFileSync, spawnSync} from 'node:child_process';
import {cpSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

function git(...args) {
  return execFileSync('git', args, {encoding: 'utf8'}).trim();
}

const project = resolve(process.cwd());
const gitRoot = resolve(git('rev-parse', '--show-toplevel'));
const branch = git('branch', '--show-current');
const origin = git('remote', 'get-url', 'origin');

if (gitRoot.toLowerCase() !== project.toLowerCase() || branch !== 'codex/quistock-dashboard' ||
    !/^(?:https:\/\/github\.com\/|git@github\.com:)AlunoHenryRodrigues\/Dashboard-Tarefas-QuiStock(?:\.git)?$/i.test(origin)) {
  console.error('Abra o terminal na pasta clonada Dashboard-QuiStock-atual, na branch codex/quistock-dashboard.');
  process.exit(1);
}

const site = resolve('site');
rmSync(site, {recursive: true, force: true});
mkdirSync(site, {recursive: true});
cpSync(resolve('dist'), site, {recursive: true});
writeFileSync(resolve(site, '.nojekyll'), '');

git('add', '-A', '--', 'site');
const changed = spawnSync('git', ['diff', '--cached', '--quiet', '--', 'site']).status === 1;
if (changed) {
  git('commit', '--only', '-m', 'Atualiza dashboard publicado com dados da planilha', '--', 'site');
}
execFileSync('git', ['push', 'origin', 'HEAD:refs/heads/codex/quistock-dashboard'], {stdio: 'inherit'});
console.log('Dashboard enviado para o GitHub Pages. A atualização pode levar alguns minutos.');
