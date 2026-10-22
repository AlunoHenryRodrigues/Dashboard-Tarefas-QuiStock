import ExcelJS from 'exceljs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
let workbook=process.env.QUISTOCK_TEST_XLSX;
let temporary;
if(!workbook){
 temporary=await mkdtemp(join(tmpdir(),'quistock-viewer-test-'));
 workbook=join(temporary,'QuiStock.xlsx');
 const wb=new ExcelJS.Workbook();
 for(const [year,names] of [[1,['Teste A','Teste B']],[2,['Teste C','Teste D']]]){
  const a=wb.addWorksheet(`Análises - ${year}º`);
  a.addRow(['Nome','Concluída','Em Andamento','Total',null,'Matéria','Horas Trabalhadas']);
  for(const name of names)a.addRow([name,null,null,null,null,'BD',999]);
  a.addRow([]);a.addRow(['Integrante','Seletor auxiliar']);
  const t=wb.addWorksheet(`Tarefas - ${year}º`);
  t.addRow(['Descrição','Horas Trabalhadas','Data de Conclusão','Status',...names]);
  if(year===1){
   t.addRow(['Compartilhada',4,'01/10/2026','Concluída',true,true]);
   t.addRow(['Individual',2,'02/10/2026','Concluída',true,false]);
   t.addRow(['Sem horas',null,null,'Em Andamento',false,true]);
  }
 }
 await wb.xlsx.writeFile(workbook);
}
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5174','--strictPort'],{stdio:'inherit',env:{...process.env,QUISTOCK_WORKBOOK:workbook}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.kill(signal));
server.on('exit',async code=>{if(temporary)await rm(temporary,{recursive:true,force:true});process.exit(code??0)});
