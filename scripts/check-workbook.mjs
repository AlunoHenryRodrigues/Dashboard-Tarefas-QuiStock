import {existsSync} from 'node:fs';
import {resolve} from 'node:path';

const candidates = [
  ...(process.env.QUISTOCK_WORKBOOK ? [process.env.QUISTOCK_WORKBOOK] : []),
  'dados/QuiStock.xlsx',
  'QuiStock.xlsx',
];

const workbook = candidates.map(path => resolve(path)).find(path => existsSync(path));

if (!workbook) {
  console.error('Planilha não encontrada. Coloque QuiStock.xlsx na pasta dados antes de publicar.');
  process.exitCode = 1;
} else {
  console.log(`Publicando dados da planilha: ${workbook}`);
}
