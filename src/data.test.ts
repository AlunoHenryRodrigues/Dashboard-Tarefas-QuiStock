import {describe,it,expect} from 'vitest';
import ExcelJS from 'exceljs';
import {duration,guessMapping,parseSheets,readWorkbook,metrics,members,type Sheet,type Cell} from './data';
const cell=(value:unknown,format=''):Cell=>({value,format});
const sheet=(name:string,rows:unknown[][]):Sheet=>({name,rows:rows.map(r=>r.map(v=>cell(v)))});
// Dados sintéticos exclusivos dos testes. Não são carregados pela aplicação.
describe('duração e valores ausentes',()=>{
 it('converte decimais brasileiros, minutos, duração Excel e mais de 24h',()=>{
  expect(duration(cell('2,5'),'decimal')).toBe(2.5);
  expect(duration(cell(150),'minutes')).toBe(2.5);
  expect(duration(cell(0.5,'[h]:mm'),'excel')).toBe(12);
  expect(duration(cell('26:30'),'decimal')).toBe(26.5);
  expect(duration(cell('2h 30min'),'decimal')).toBe(2.5);
  expect(duration(cell('02:30:30'),'decimal')).toBeCloseTo(2.508333333);
 });
 it('preserva zeros e recusa dados inválidos',()=>{
  expect(duration(cell(0),'excel')).toBe(0);
  for(const v of [null,'',-1,'02:90','abc']) expect(duration(cell(v),'decimal')).toBeNull();
  expect(duration(cell(new Date('2026-10-01')),'decimal')).toBeNull();
 });
});
describe('interpretação real do arquivo xlsx',()=>{
 it('lê abas, formatação, fórmulas com e sem resultados e rich text',async()=>{
  const wb=new ExcelJS.Workbook();const ws=wb.addWorksheet('Análises 1º ano');
  ws.addRow(['Integrante','Horas','Demandas']);ws.addRow(['Teste A',{formula:'1+1',result:2},3]);
  ws.addRow([{richText:[{text:'Teste B'}]},{formula:'1+1'},0]);
  const bytes=await wb.xlsx.writeBuffer();const sheets=await readWorkbook(bytes as ArrayBuffer);
  expect(sheets[0].name).toBe('Análises 1º ano');
  expect(sheets[0].rows[1][1].value).toBe(2);expect(sheets[0].rows[2][1].value).toBeNull();
  expect(sheets[0].rows[2][0].value).toBe('Teste B');
  const d=parseSheets(sheets,[guessMapping(sheets[0],'1ano')],'teste.xlsx');
  expect(d.warnings.some(w=>w.includes('fórmulas sem resultado'))).toBe(true);
  expect(metrics(d.records).hours).toBeNull();
 });
});
describe('durações em sistemas de data Excel',()=>{
 for(const date1904 of [false,true]) it(`preserva duração formatada, date1904=${date1904}`,async()=>{
  const wb=new ExcelJS.Workbook();wb.properties.date1904=date1904;const ws=wb.addWorksheet('Análise');
  ws.addRow(['Nome','Horas','Demandas']);ws.addRow(['Teste',1.5,1]);ws.getCell('B2').numFmt='[h]:mm';
  const bytes=await wb.xlsx.writeBuffer();const sheets=await readWorkbook(bytes as ArrayBuffer);
  expect(duration(sheets[0].rows[1][1],'excel')).toBe(36);
 });
});
describe('resumos, turmas e demanda compartilhada',()=>{
 it('normaliza nomes, inclui zero, ignora totais e separa turmas',()=>{
  const a=sheet('Análise 1',[['Integrante','Horas','Demandas'],[' José  Silva ',2,1],['JOSE SILVA',1,2],['Teste Zero',0,0],['Total',3,3]]);
  const b=sheet('Análise 2',[['Nome','Horas','Demandas'],['José Silva',4,2]]);
  const d=parseSheets([a,b],[guessMapping(a,'1ano'),guessMapping(b,'2ano')],'teste.xlsx');
  const m=metrics(d.records);expect(m.people).toHaveLength(3);expect(m.hours).toBe(7);expect(m.demands).toBe(5);expect(m.unique).toBe(false);
  expect(m.people.find(p=>p.year==='1ano'&&p.name.includes('José'))?.hours).toBe(3);
  expect(metrics(d.records.filter(r=>r.year==='1ano')).average).toBe(1.5);
 });
 it('conta demanda uma vez, participações por pessoa e rateia horas',()=>{
  const a=sheet('Tarefas',[['Responsável','Horas','ID','Data','Status'],['Teste A; Teste B',4,'D1','01/10/2026','Concluída'],['Teste A',2,'D2','02/10/2026','Aberta']]);
  const map={...guessMapping(a,'1ano'),mode:'tasks' as const};const d=parseSheets([a],[map],'teste.xlsx');
  const m=metrics(d.records);expect(m.hours).toBe(6);expect(m.demands).toBe(2);expect(m.perDemand).toBe(3);expect(m.unique).toBe(true);
  expect(members(d.records).find(p=>p.name==='Teste A')?.hours).toBe(4);
  expect(metrics(d.records.filter(r=>r.status==='Concluída')).demands).toBe(1);
  expect(d.records[0].date).toBe('2026-10-01');
 });
 it('rejeita IDs repetidos e bases duplicadas',()=>{
  const a=sheet('Tarefas',[['Responsável','Horas','ID'],['Teste A',1,'X'],['Teste B',2,'X']]);
  const m={...guessMapping(a,'1ano'),mode:'tasks' as const};
  expect(()=>parseSheets([a],[m],'teste.xlsx')).toThrow('ID de demanda repetido');
  expect(()=>parseSheets([a],[m,m],'teste.xlsx')).toThrow('uma única base por turma');
 });
 it('não transforma ausência em zero nem divisão por zero em infinito',()=>{
  const a=sheet('Análise',[['Nome','Horas','Demandas'],['Teste A',null,0],['Teste B',0,0]]);
  const d=parseSheets([a],[guessMapping(a,'1ano')],'teste.xlsx');
  const m=metrics(d.records);expect(m.hours).toBeNull();expect(m.average).toBeNull();expect(m.perDemand).toBeNull();expect(m.people[1].hours).toBe(0);
 });
});
