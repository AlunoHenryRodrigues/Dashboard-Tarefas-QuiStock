import {defineConfig, type Plugin} from 'vite';
import react from '@vitejs/plugin-react';
import {existsSync} from 'node:fs';
import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {readWorkbook,parseDashboardWorkbook} from './src/data';

// Read the private workbook on the development/build machine. Visitors receive
// calculated dashboard data; the original workbook is never a public asset.
function workbookSource():Plugin {
 const id='virtual:quistock-data',resolved='\0'+id;
 const locations=[...(process.env.QUISTOCK_WORKBOOK?[resolve(process.env.QUISTOCK_WORKBOOK)]:[]),resolve('dados/QuiStock.xlsx'),resolve('QuiStock.xlsx')];
 return {
  name:'quistock-workbook',
  resolveId(source){if(source===id)return resolved;},
  async load(source){
   if(source!==resolved)return;
   const file=locations.find(p=>existsSync(p));
   if(!file)return 'export default null;';
   const bytes=await readFile(file);
   const sheets=await readWorkbook(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
   const data=parseDashboardWorkbook(sheets,'QuiStock.xlsx');
   data.importedAt=(await stat(file)).mtime.toISOString();
   return `export default ${JSON.stringify(data)};`;
  },
  configureServer(server){
   server.watcher.add(locations);
   const reload=(path:string)=>{if(locations.includes(resolve(path))){const module=server.moduleGraph.getModuleById(resolved);if(module)server.moduleGraph.invalidateModule(module);server.ws.send({type:'full-reload'});}};
   server.watcher.on('add',reload);server.watcher.on('change',reload);server.watcher.on('unlink',reload);
  }
 };
}
export default defineConfig({plugins:[react(),workbookSource()],base:'./'});
