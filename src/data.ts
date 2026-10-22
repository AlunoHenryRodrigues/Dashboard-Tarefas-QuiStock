export type Cell = { value: unknown; format: string; formula?: string };
export type Sheet = { name: string; rows: Cell[][] };
export type Mapping = { sheet: string; year: '1ano'|'2ano'; header: number; mode: 'summary'|'tasks'; name: number; hours: number; demands: number; id: number; date: number; status: number; unit: 'decimal'|'excel'|'minutes' };
export type RecordRow = { key: string; name: string; year: string; hours: number|null; demands: number|null; task: string|null; date: string|null; status: string|null; source: string; row: number };
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
 let header=s.rows.findIndex(row=>row.some(c=>namePattern.test(norm(c.value)))); if(header<0) header=0;
 const labels=s.rows[header]?.map(c=>norm(c.value))||[];
 const find=(r:RegExp)=>labels.findIndex(x=>r.test(x));
 const demands=find(/demanda|tarefa|atividade|quantidade/);
 return {sheet:s.name,year,header,mode:'summary',name:find(namePattern),hours:find(/hora|duracao|tempo/),demands,id:find(/^(id|codigo)( da demanda| da tarefa)?$/),date:find(/data/),status:find(/status|situacao/),unit:'decimal'};
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
  if(m.name<0 || (m.hours<0&&m.demands<0&&m.mode==='summary')) throw new Error('Mapeie integrante e pelo menos uma medida.');
  let skipped=0, missing=0, formulas=0, invalidDates=0, missingCounts=0; const before=records.length;
  for(let i=m.header+1;i<sheet.rows.length;i++) {
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
 return {records,warnings,mappings,source,importedAt:new Date().toISOString(),sheets:mappings.map(m=>m.sheet)};
}
export const sum = (values: (number|null)[]):number|null => !values.length || values.some(v=>v==null)?null:values.reduce<number>((s,v)=>s+(v??0),0);
export type Member = { key:string; name:string; year:string; hours:number|null; demands:number|null; rows:RecordRow[] };
export function members(records:RecordRow[]):Member[] {
 const map=new Map<string,RecordRow[]>(); records.forEach(r=>{const group=map.get(r.key);if(group)group.push(r);else map.set(r.key,[r]);});
 return [...map].map(([key,rows])=>({key,name:rows[0].name,year:rows[0].year,hours:sum(rows.map(r=>r.hours)),demands:sum(rows.map(r=>r.demands)),rows}));
}
export function metrics(records:RecordRow[]) {
 const people=members(records); const hours=sum(people.map(p=>p.hours));
 const unique=records.length>0&&records.every(r=>r.task!=null);
 const demands=unique?new Set(records.map(r=>r.task)).size:sum(people.map(p=>p.demands));
 return {people,hours,demands,unique,average:hours==null||!people.length?null:hours/people.length,perDemand:hours==null||!demands?null:hours/demands};
}
