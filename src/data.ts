export type Cell = { value: unknown; format: string; formula?: string };
export type Sheet = { name: string; rows: Cell[][] };
export type Mapping = { sheet: string; year: '1ano'|'2ano'; header: number; mode: 'summary'|'tasks'|'matrix'; taskSheet?: string; endRow?: number; name: number; hours: number; demands: number; id: number; date: number; status: number; unit: 'decimal'|'excel'|'minutes' };
export type RecordRow = { key: string; name: string; year: string; hours: number|null; demands: number|null; task: string|null; date: string|null; status: string|null; source: string; row: number; kind?: 'roster'|'matrix'|'unassigned'; title?: string };
export type Dataset = { records: RecordRow[]; warnings: string[]; mappings: Mapping[]; source: string; importedAt: string; sheets: string[] };
export const norm = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
export function cellText(c?: Cell) { return c?.value == null ? '' : String(c.value).trim(); }
export async function readWorkbook(buffer: ArrayBuffer): Promise<Sheet[]> {
 const {default: Excel} = await import('exceljs');
 const wb = new Excel.Workbook(); await wb.xlsx.load(buffer);
 return wb.worksheets.map(s => {
  if(s.rowCount>50000 || s.columnCount>200) throw new Error(`A aba ${s.name} excede o limite de 50.000 linhas ou 200 colunas.`);
  const rows: Cell[][]=[];
  s.eachRow({includeEmpty:true}, row => { const cells: Cell[]=[]; for(let i=1;i<=s.columnCount;i++) {
   const c=row.getCell(i); let v: unknown = c.value; let formula: string|undefined;
   if(v && typeof v==='object' && !(v instanceof Date)) { const o=v as {formula?:string; sharedFormula?:string; result?:unknown; richText?:{text:string}[]; text?:string; error?:string};
    if(o.formula || o.sharedFormula) { formula=o.formula || o.sharedFormula; v=o.result ?? null; }
    else if(o.richText) v=o.richText.map(x=>x.text).join(''); else if(o.text) v=o.text; else v=null;
   }
   if(v instanceof Date && !/[dy]/i.test((c.numFmt||'').replace(/"[^"]*"/g,''))) {
    const epoch=wb.properties.date1904?Date.UTC(1904,0,1):Date.UTC(1899,11,30);
    v=(v.getTime()-epoch)/86400000;
   }
   cells.push({value:v,format:c.numFmt||'',formula});
  } rows.push(cells); }); return {name:s.name,rows};
 });
}
export function guessMapping(s: Sheet, year: Mapping['year']): Mapping {
 const namePattern=/^(nome|integrante|integrantes|membro|responsavel|responsaveis|aluno|colaborador)( completo)?$/;
 // Multiple side-by-side tables must never lend each other numeric columns.
 let header=s.rows.findIndex(row=>row.some(c=>namePattern.test(norm(c.value)))); if(header<0) header=0;
 const labels=s.rows[header]?.map(c=>norm(c.value))||[];
 const name=labels.findIndex(x=>namePattern.test(x));
 let end=labels.length,start=0;
 for(let i=name-1;i>=0;i--){if(!labels[i]){start=i+1;break;}}
 if(name>=0) {const gap=labels.findIndex((x,i)=>i>name&&!x);if(gap>=0)end=gap;}
 const find=(r:RegExp)=>labels.findIndex((x,i)=>i>=start&&i<end&&r.test(x));
 const analysis=/analis/.test(norm(s.name));
 let endRow: number|undefined;
 if(analysis&&name>=0){endRow=header+1;while(endRow<s.rows.length&&cellText(s.rows[endRow]?.[name]))endRow++;}
 return {sheet:s.name,year,header,mode:'summary',name,hours:find(/hora|duracao|tempo/),demands:find(/demanda|tarefa|atividade|quantidade|^total$/),id:find(/^(id|codigo)( da demanda| da tarefa)?$/),date:find(/data/),status:find(/status|situacao/),unit:'decimal',endRow};
}
function taskHeader(s: Sheet) {
 return s.rows.findIndex(row=>row.some(c=>norm(c.value)==='descricao')&&row.some(c=>norm(c.value)==='horas trabalhadas')&&row.some(c=>norm(c.value)==='status'));
}
export function configureMapping(sheets: Sheet[], sheet: Sheet, year: Mapping['year']): Mapping {
 const m=guessMapping(sheet,year);
 if(!/analis/.test(norm(sheet.name))||m.name<0||m.demands<0)return m;
 const block=sheet.rows[m.header]?.map(c=>norm(c.value))||[];
 if(!block.includes('concluida')||!block.includes('em andamento'))return m;
 const yearNumber=year==='1ano'?'1':'2';
 const tasks=sheets.filter(s=>/tarefa/.test(norm(s.name))&&new RegExp(`(?:^|\\D)${yearNumber}(?:\\D|$)`).test(s.name)&&taskHeader(s)>=0);
 if(tasks.length!==1)return m;
 return {...m,mode:'matrix',taskSheet:tasks[0].name};
}
export function suggestMappings(sheets: Sheet[]): Mapping[] {
 const analysis=sheets.filter(s=>/analis/.test(norm(s.name)));
 const candidates=analysis.length?analysis:sheets;
 if(!candidates.length)return [];
 const first=candidates.find(s=>/1|primeir/i.test(s.name))||candidates[0];
 const second=candidates.find(s=>s!==first&&/2|segund/i.test(s.name));
 return [configureMapping(sheets,first,'1ano'),...(second?[configureMapping(sheets,second,'2ano')]:[])];
}
export function duration(cell: Cell|undefined, unit: Mapping['unit']): number|null {
 if(cell?.value==null || cell.value==='') return null;
 let v=cell.value;
 if(v instanceof Date) {
  if(unit!=='excel' || !Number.isFinite(v.getTime())) return null;
  const epoch=Date.UTC(1899,11,30); const hours=(v.getTime()-epoch)/3600000;
  return hours>=0 && hours<240000 ? hours:null;
 }
 if(typeof v==='number') { if(!Number.isFinite(v)||v<0) return null; return unit==='minutes'?v/60:unit==='excel'?v*24:v; }
 const str=String(v).trim();
 const clock=str.match(/^(\d+):([0-5]\d)(?::([0-5]\d))?$/);
 if(clock) return +clock[1]+ +clock[2]/60+ +(clock[3]||0)/3600;
 const minutes=str.match(/^(\d+(?:[.,]\d+)?)\s*(?:m|min|minuto|minutos)$/i);
 if(minutes)return Number(minutes[1].replace(',','.'))/60;
 const units=str.match(/^(\d+(?:[.,]\d+)?)\s*h(?:\s*(\d+)\s*(?:m|min))?$/i);
 if(units) return Number(units[1].replace(',','.'))+Number(units[2]||0)/60;
 if(!/^\d+(?:[.,]\d+)?$/.test(str)) return null;
 return duration({value:Number(str.replace(',','.')),format:cell?.format||''},unit);
}
function count(c?: Cell): number|null { if(c?.value==null||c.value==='') return null; const n=Number(String(c.value).replace(',','.')); return Number.isInteger(n)&&n>=0?n:null; }
function dateValue(c?: Cell): string|null {
 const v=c?.value; if(v==null||v==='') return null;
 if(v instanceof Date && Number.isFinite(v.getTime())) return v.toISOString().slice(0,10);
 if(typeof v==='number' && v>0 && v<100000) return new Date(Date.UTC(1899,11,30)+Math.floor(v)*86400000).toISOString().slice(0,10);
 const s=String(v).trim(); let iso=s;
 const m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if(m) iso=`${m[3]}-${m[2]}-${m[1]}`;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
 const d=new Date(iso+'T00:00:00Z'); return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===iso?iso:null;
}
export function parseSheets(sheets: Sheet[], mappings: Mapping[], source: string): Dataset {
 const records:RecordRow[]=[]; const warnings:string[]=[]; const seenTasks=new Set<string>();
 if(new Set(mappings.map(m=>m.year)).size!==mappings.length) throw new Error('Escolha uma única base por turma para evitar dupla contagem.');
 if(new Set(mappings.map(m=>m.sheet)).size!==mappings.length) throw new Error('Escolha abas diferentes para cada turma.');
 for(const m of mappings) {
  const sheet=sheets.find(s=>s.name===m.sheet); if(!sheet) throw new Error('Aba não encontrada.');
  if(m.mode==='matrix'){const result=parseMatrix(sheets,m);records.push(...result.records);warnings.push(...result.warnings);continue;}
  if(m.name<0 || (m.hours<0&&m.demands<0&&m.mode==='summary')) throw new Error('Mapeie integrante e pelo menos uma medida.');
  let skipped=0, missing=0, formulas=0, invalidDates=0, missingCounts=0; const before=records.length;
  for(let i=m.header+1;i<(m.endRow??sheet.rows.length);i++) {
   const row=sheet.rows[i], name=cellText(row[m.name]);
   if(!name || /^(total|subtotal|media|média|total geral|soma)(\b|:)/i.test(name)) { if(name) skipped++; continue; }
   const hours=duration(row[m.hours],m.unit);
   if(m.hours>=0 && hours==null) missing++;
   if(m.mode==='summary'&&m.demands>=0&&count(row[m.demands])==null) missingCounts++;
   if(row.some(c=>c.formula && c.value==null)) formulas++;
   const date=m.mode==='tasks'?dateValue(row[m.date]):null;
   if(m.mode==='tasks'&&m.date>=0&&cellText(row[m.date])&&!date) invalidDates++;
   const names=m.mode==='tasks'?Array.from(new Map(name.split(/[;\n]+/).map(n=>[norm(n),n.trim()])).values()).filter(Boolean):[name];
   const task=m.mode==='tasks'?`${m.year}:${m.sheet}:${m.id>=0?cellText(row[m.id])||`linha-${i+1}`:`linha-${i+1}`}`:null;
   if(task && seenTasks.has(task)) throw new Error(`ID de demanda repetido na aba ${m.sheet}, linha ${i+1}. Consolide os responsáveis em uma linha separados por ponto e vírgula ou selecione “uma demanda por linha” sem ID.`);
   if(task) seenTasks.add(task);
   names.forEach(n=>records.push({key:`${m.year}:${norm(n)}`,name:n,year:m.year,hours:hours==null?null:hours/names.length,demands:m.mode==='tasks'?1:count(row[m.demands]),task,date,status:m.mode==='tasks'?cellText(row[m.status])||null:null,source:m.sheet,row:i+1}));
  }
  if(records.length===before) throw new Error(`Nenhum integrante encontrado em ${m.sheet}. Confira a linha dos cabeçalhos.`);
  if(skipped) warnings.push(`${m.sheet}: ${skipped} linhas de total/subtotal ignoradas.`);
  if(missing) warnings.push(`${m.sheet}: ${missing} registros com horas ausentes ou inválidas. Totais afetados aparecem como “Sem dados”.`);
  if(missingCounts) warnings.push(`${m.sheet}: ${missingCounts} contagens ausentes ou inválidas; totais afetados ficam indisponíveis.`);
  if(formulas) warnings.push(`${m.sheet}: ${formulas} linhas com fórmulas sem resultado salvo. Recalcule e salve no Excel; o navegador não calcula fórmulas.`);
  if(invalidDates) warnings.push(`${m.sheet}: ${invalidDates} datas inválidas; esses registros ficam fora do filtro de período.`);
  if(m.mode==='summary') warnings.push(`${m.sheet}: demandas são participações individuais agregadas; o total de demandas únicas e a evolução temporal não podem ser inferidos.`);
 }
 return {records,warnings,mappings,source,importedAt:new Date().toISOString(),sheets:[...new Set(mappings.flatMap(m=>[m.sheet,...(m.mode==='matrix'&&m.taskSheet?[m.taskSheet]:[])]))]};
}
export const sum = (values: (number|null)[]):number|null => !values.length || values.some(v=>v==null)?null:values.reduce<number>((s,v)=>s+(v??0),0);
export const sumKnown = (values: (number|null)[]):number|null => {
 const valid=values.filter((v):v is number=>v!=null);return valid.length?valid.reduce((a,b)=>a+b,0):null;
};
export type Member = { key:string; name:string; year:string; hours:number|null; demands:number|null; rows:RecordRow[]; missingHours:number };
export function members(records:RecordRow[]):Member[] {
 const map=new Map<string,RecordRow[]>(); records.filter(r=>r.kind!=='unassigned').forEach(r=>{const group=map.get(r.key);if(group)group.push(r);else map.set(r.key,[r]);});
 return [...map].map(([key,rows])=>{
  const tasks=rows.filter(r=>r.kind!=='roster');
  const values=(tasks.length?tasks:rows).map(r=>r.hours);
  const matrix=rows.some(r=>r.kind==='matrix'||r.kind==='roster');
  return {key,name:rows[0].name,year:rows[0].year,hours:matrix?sumKnown(values):sum(values),demands:sum(rows.map(r=>r.demands)),rows,missingHours:tasks.filter(r=>r.hours==null).length};
 });
}
export function metrics(records:RecordRow[]) {
 const people=members(records);
 const matrix=records.some(r=>r.kind==='matrix'||r.kind==='roster'||r.kind==='unassigned');
 const values=[...people.map(p=>p.hours),...records.filter(r=>r.kind==='unassigned').map(r=>r.hours)];
 const hours=matrix?sumKnown(values):sum(values);
 const tasks=records.filter(r=>r.kind!=='roster');
 const unique=records.length>0&&tasks.every(r=>r.task!=null);
 const demands=unique?new Set(tasks.map(r=>r.task)).size:sum(people.map(p=>p.demands));
 const missingHours=new Set(tasks.filter(r=>r.hours==null).map(r=>r.task??`${r.source}:${r.row}`)).size;
 const unassigned=new Set(records.filter(r=>r.kind==='unassigned').map(r=>r.task)).size;
 return {people,hours,demands,unique,missingHours,partial:matrix&&missingHours>0,unassigned,average:hours==null||!people.length?null:hours/people.length,perDemand:hours==null||!demands?null:hours/demands};
}
function checked(c?:Cell){return c?.value===true||c?.value===1||['true','verdadeiro','sim','x'].includes(norm(c?.value));}
function parseMatrix(sheets:Sheet[],m:Mapping):{records:RecordRow[];warnings:string[]} {
 const analysis=sheets.find(s=>s.name===m.sheet)!;
 const tasks=sheets.find(s=>s.name===m.taskSheet);
 if(!tasks)throw new Error(`Aba de tarefas não encontrada para ${m.sheet}.`);
 const header=taskHeader(tasks);
 if(header<0)throw new Error(`Cabeçalho de tarefas não reconhecido em ${tasks.name}.`);
 const labels=tasks.rows[header].map(c=>norm(c.value));
 const description=labels.indexOf('descricao'),hoursCol=labels.indexOf('horas trabalhadas'),statusCol=labels.indexOf('status'),dateCol=labels.indexOf('data de conclusao');
 // QuiStock puts one boolean checkbox column per member after Status.
 const people=new Map<string,{name:string;column:number;row:number;cached:number|null}>();
 for(let row=m.header+1;row<(m.endRow??analysis.rows.length);row++){
  const name=cellText(analysis.rows[row]?.[m.name]);if(!name)break;
  if(/^(total|subtotal|integrante|nome)$/i.test(name))break;
  people.set(norm(name),{name,column:labels.findIndex((label,i)=>i>statusCol&&label===norm(name)),row:row+1,cached:count(analysis.rows[row]?.[m.demands])});
 }
 for(let column=statusCol+1;column<labels.length;column++){
  const name=cellText(tasks.rows[header][column]);
  if(name&&!people.has(norm(name)))people.set(norm(name),{name,column,row:header+1,cached:null});
 }
 for(const person of people.values())if(person.column<0)throw new Error(`Não há coluna de responsável para ${person.name} em ${tasks.name}. Confira o par de abas da mesma turma.`);
 if(!people.size)throw new Error(`Nenhum integrante encontrado no bloco de pessoas de ${m.sheet}.`);
 const records:RecordRow[]=[...people.values()].map(p=>({key:`${m.year}:${norm(p.name)}`,name:p.name,year:m.year,hours:0,demands:0,task:null,date:null,status:null,source:p.column<0?m.sheet:tasks.name,row:p.column<0?p.row:header+1,kind:'roster',title:'Integrante cadastrado (não é uma demanda)'}));
 let missing=0,unassigned=0,dated=0,known=0;
 for(let i=header+1;i<tasks.rows.length;i++){
  const row=tasks.rows[i],title=cellText(row[description]);
  if(!title||/^(total|subtotal)(\b|:)/i.test(title))continue;
  const value=duration(row[hoursCol],m.unit);
  if(value==null)missing++;else known++;
  const assigned=[...people.values()].filter(p=>p.column>=0&&checked(row[p.column]));
  const task=`${m.year}:${tasks.name}:linha-${i+1}`;
  const date=dateValue(row[dateCol]);if(date)dated++;
  const common={year:m.year,task,date,status:cellText(row[statusCol])||null,source:tasks.name,row:i+1,title};
  if(!assigned.length){unassigned++;records.push({...common,key:`${m.year}:unassigned:${i}`,name:'',hours:value,demands:1,kind:'unassigned'});}
  else assigned.forEach(p=>records.push({...common,key:`${m.year}:${norm(p.name)}`,name:p.name,hours:value==null?null:value/assigned.length,demands:1,kind:'matrix'}));
 }
 const warnings=[`${m.sheet}: cadastro de integrantes lido no bloco “Nome / Total”, linhas ${m.header+2}–${m.endRow??analysis.rows.length}. Horas por matéria e painéis auxiliares não entram nas contas.`,`${tasks.name}: demandas contadas pelas descrições preenchidas e responsáveis pelas caixas marcadas. Horas compartilhadas são divididas igualmente. Resultados de fórmulas sem cache não são inventados.`];
 const actual=members(records);
 for(const p of people.values()){
  const derived=actual.find(x=>norm(x.name)===norm(p.name))?.demands;
  if(p.cached!=null&&p.cached!==derived)warnings.push(`${m.sheet}: total salvo de ${p.name} (${p.cached}) diverge das tarefas (${derived}). O dashboard usa as tarefas para manter filtros e contagens consistentes.`);
 }
 if(missing)warnings.push(`${tasks.name}: ${missing} demandas sem horas válidas; ${known} com horas registradas. O dashboard mostra o subtotal conhecido com aviso de parcial, sem tratar campos vazios como zero.`);
 if(unassigned)warnings.push(`${tasks.name}: ${unassigned} demandas sem responsável são incluídas no total da turma, mas não criam integrantes no ranking.`);
 if(dated)warnings.push(`${tasks.name}: o período e a evolução usam exclusivamente “Data de Conclusão”; prazo não é data de trabalho. Demandas sem conclusão saem do filtro de período.`);
 return {records,warnings};
}
