import React, {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BarChart,Bar,XAxis,YAxis,Tooltip,ResponsiveContainer,PieChart,Pie,Cell,CartesianGrid} from 'recharts';
import {BarChart3,Clock3,FileSpreadsheet,GraduationCap,Trophy,Users,ArrowUpRight,ArrowDownRight,CheckCircle2} from 'lucide-react';
import initialData from 'virtual:quistock-data';
import {metrics,type Member} from './data';
import './style.css';
const format=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2});
const number=(n:number|null)=>n==null?'Sem dados':format.format(n);
const hours=(n:number|null)=>n==null?'Sem dados':`${number(n)} h`;
const colors=['#A3E635','#7C3AED','#A78BFA','#BEF264','#4C1D95','#C4B5FD'];
const tooltipStyle={background:'#17171F',border:'1px solid #464050',borderRadius:10,color:'#F5F5F7'};
type Year='1ano'|'2ano';
const currentYear=():Year=>new URLSearchParams(location.search).get('turma')==='2ano'?'2ano':'1ano';
function App(){
 const [year,setYear]=useState<Year>(currentYear);
 useEffect(()=>{const pop=()=>setYear(currentYear());window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop)},[]);
 function navigate(next:Year){if(next===year)return;setYear(next);const url=new URL(location.href);url.searchParams.set('turma',next);history.pushState({},'',url);window.scrollTo({top:0,behavior:'smooth'})}
 const records=(initialData?.records||[]).filter(r=>r.year===year);
 const stats=metrics(records);
 const people=[...stats.people].sort((a,b)=>(b.hours??-1)-(a.hours??-1)||a.name.localeCompare(b.name,'pt-BR'));
 const demands=[...stats.people].sort((a,b)=>(b.demands??-1)-(a.demands??-1)||a.name.localeCompare(b.name,'pt-BR'));
 function extreme(field:'hours'|'demands',lowest=false){
  const valid=people.filter(p=>p[field]!=null);
  if(!valid.length)return null;
  const value=(lowest?Math.min:Math.max)(...valid.map(p=>p[field]!));
  return {names:valid.filter(p=>p[field]===value).map(p=>p.name),value};
 }
 const topHours=extreme('hours'),lowHours=extreme('hours',true),topDemands=extreme('demands'),lowDemands=extreme('demands',true);
 const distribution=people.filter(p=>p.hours!=null&&p.hours>0).map(p=>({name:p.name,value:p.hours!}));
 const pie=distribution.length>7?[...distribution.slice(0,6),{name:'Outros integrantes',value:distribution.slice(6).reduce((s,p)=>s+p.value,0)}]:distribution;
 const distributed=distribution.reduce((s,p)=>s+p.value,0);
 const positions=new Map<number|null,number>();people.forEach((p,i)=>{if(!positions.has(p.hours))positions.set(p.hours,i+1)});
 return <div className="app viewer"><aside className="sidebar">
  <a className="brand" href="?turma=1ano"><span className="brand-mark"><BarChart3 size={25}/></span><span>QuiStock<span className="brand-dot">.</span><small>DESEMPENHO DO PROJETO</small></span></a>
  <div className="workspace"><div className="workspace-icon">Q</div><div>Projeto escolar<small>Contribuições de cada integrante</small></div><span className="live-dot"/></div>
  <p className="nav-caption">ESCOLHA A TURMA</p>
  <nav aria-label="Turmas">{(['1ano','2ano'] as const).map((y,i)=><button aria-label={`Dashboard do ${i+1}º ano`} aria-current={year===y?'page':undefined} className={`nav-item ${year===y?'active':''}`} key={y} onClick={()=>navigate(y)}><GraduationCap size={20}/><span>{i+1}º ano do Ensino Médio</span>{year===y&&<span className="nav-indicator"/>}</button>)}</nav>
  <div className="sidebar-bottom"><div className="privacy"><BarChart3 size={22}/><strong>Cada contribuição conta.</strong><p>Horas, demandas e resultados. Uma visão clara de quem faz o projeto acontecer.</p></div><div className="sidebar-footer">QUISTOCK <span>DESEMPENHO</span></div></div>
 </aside><main><header className="topbar"><div className="breadcrumb">Desempenho do projeto <span>/</span><span>{year==='1ano'?'1º':'2º'} ano</span></div><span className="local-badge"><span className="live-dot"/>Somente visualização</span></header>
 <div className="content"><div className="page-heading"><div><div className="eyebrow"><span/>DESEMPENHO DOS INTEGRANTES</div><h1>Dashboard do {year==='1ano'?'1º':'2º'} ano<span className="heading-dot">.</span></h1><p>Quem contribuiu, quantas demandas e quanto tempo dedicou ao projeto.</p></div><span className="year-seal"><GraduationCap size={22}/>{year==='1ano'?'1º':'2º'} ano · Ensino Médio</span></div>
 {!initialData?<section className="panel no-source"><FileSpreadsheet size={36}/><h2>Os dados ainda não estão disponíveis.</h2><p>A planilha do projeto precisa ser conectada pelo responsável. Depois disso, os resultados das duas turmas aparecem aqui automaticamente.</p></section>:<>
 <div className="viewer-caption" aria-live="polite"><span><Users size={15}/>{people.length} integrantes</span><span><CheckCircle2 size={14}/>Dados da planilha do projeto</span><span className="source-date">Base atualizada em {new Date(initialData.importedAt).toLocaleString('pt-BR')}</span></div>
 <section className="kpi-grid" aria-label="Indicadores da turma">
 <Kpi title="Horas registradas" value={hours(stats.hours)} note={stats.partial?'Total parcial · há tarefas sem horas':'Total de horas da turma'} icon={<Clock3/>} featured/>
 <Kpi title="Total de demandas" value={number(stats.demands)} note="Cada tarefa é contada uma única vez" icon={<FileSpreadsheet/>}/>
 <Kpi title="Integrantes da turma" value={number(people.length)} note="Todos os integrantes cadastrados" icon={<Users/>}/>
 <Kpi title="Média de horas por integrante" value={hours(stats.average)} note={stats.partial?'Média das horas registradas · parcial':'Horas da turma ÷ integrantes'} icon={<BarChart3/>}/>
 </section>
 <section className="spotlight-grid" aria-label="Destaques da turma">
 <Spotlight title="Quem teve mais demandas" result={topDemands} metric="demands" icon={<Trophy/>} positive/>
 <Spotlight title="Quem teve menos demandas" result={lowDemands} metric="demands" icon={<FileSpreadsheet/>}/>
 <Spotlight title="Quem registrou mais horas" result={topHours} metric="hours" icon={<ArrowUpRight/>} positive/>
 <Spotlight title="Quem registrou menos horas" result={lowHours} metric="hours" icon={<ArrowDownRight/>}/>
 </section>
 {stats.partial&&<div role="status" className="data-warning"><Clock3 size={18}/><p><strong>As horas são parciais.</strong> {stats.missingHours} das {stats.demands} demandas estão sem horas preenchidas. Os valores abaixo mostram somente o tempo registrado na planilha.</p></div>}
 {stats.demands===0&&<div className="year-empty"><FileSpreadsheet size={22}/><div><strong>Esta turma ainda não tem demandas registradas.</strong><p>Os {people.length} integrantes já aparecem abaixo. Os indicadores serão atualizados quando a planilha receber tarefas.</p></div></div>}
 <div className="chart-grid"><section className="panel"><PanelTitle title="Horas de cada integrante" subtitle="Do maior para o menor tempo registrado."/><HorizontalChart people={people} field="hours"/></section>
 <section className="panel"><PanelTitle title="Participação nas horas" subtitle="Como o tempo registrado está distribuído."/>{pie.length?<><div className="donut-container"><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={80} outerRadius={110} paddingAngle={3} stroke="none" isAnimationActive={false}>{pie.map((_,i)=><Cell key={i} fill={colors[i%colors.length]}/>)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={v=>hours(Number(v))}/></PieChart></ResponsiveContainer><div className="donut-label"><strong>{hours(distributed)}</strong><span>horas registradas</span></div></div><div className="donut-legend">{pie.map((p,i)=><div key={p.name}><span style={{background:colors[i%colors.length]}}/><strong title={p.name}>{p.name}</strong><small>{number(p.value/distributed*100)}%</small></div>)}</div></>:<Empty text="Ainda não há horas registradas para distribuir."/>}</section></div>
 <div className="chart-grid"><section className="panel"><PanelTitle title="Demandas de cada integrante" subtitle="Cada responsável recebe uma participação na tarefa."/><HorizontalChart people={demands} field="demands"/></section><section className="panel people-overview"><PanelTitle title="Toda a turma, em um olhar" subtitle="Horas e demandas de todos os integrantes."/><div className="people-list">{people.map(p=><div className="person-strip" key={p.key}><Avatar name={p.name}/><strong>{p.name}</strong><span><b>{number(p.demands)}</b> demandas</span><span className="person-hours">{hours(p.hours)}</span></div>)}</div></section></div>
 <section className="panel ranking"><PanelTitle title="Ranking completo da turma" subtitle="Ordenado por horas registradas. Em caso de empate, a posição é compartilhada."/><div className="viewer-ranking">{people.map(p=><article className="ranking-row" key={p.key}><span className={`position ${(positions.get(p.hours)??99)<=3?'podium':''}`}>{p.hours==null?'—':String(positions.get(p.hours)).padStart(2,'0')}</span><div className="rank-person"><Avatar name={p.name}/><strong>{p.name}</strong></div><div className="rank-measure"><small>Demandas</small><b>{number(p.demands)}</b></div><div className="rank-measure"><small>Horas registradas</small><b className="green-number">{hours(p.hours)}</b></div><div className="rank-measure rank-completeness"><small>Dados de horas</small><span>{p.missingHours>0?`${p.missingHours} tarefa(s) sem horas`:'Todos os registros preenchidos'}</span></div></article>)}</div></section>
 <div className="method-note"><p><strong>Como os números são contados:</strong> cada tarefa vale uma demanda para a turma. Quando há mais de um responsável, ela conta para cada pessoa e suas horas são divididas igualmente entre os participantes. Por isso, a soma das demandas individuais pode ser maior que o total da turma.</p>{stats.unassigned>0&&<p>{stats.unassigned} demanda(s) estão sem responsável e entram apenas no total da turma.</p>}</div>
 </>}
 <footer className="footer"><span><span className="brand-dot">◆</span> QuiStock <span className="footer-divider">/</span> Cada contribuição conta.</span><span>Desempenho do {year==='1ano'?'1º':'2º'} ano do Ensino Médio</span></footer></div></main></div>
}
function Avatar({name}:{name:string}){return <span className="member-avatar">{name.split(' ').filter(Boolean).slice(0,2).map(n=>n[0]).join('')}</span>}
function Kpi({title,value,note,icon,featured=false}:{title:string;value:string;note:string;icon:React.ReactNode;featured?:boolean}){return <article className={`kpi ${featured?'featured':''}`}><div className="kpi-top"><span>{title}</span><span className="kpi-icon">{icon}</span></div><strong>{value}</strong><small>{note}</small></article>}
function Spotlight({title,result,metric,icon,positive=false}:{title:string;result:{names:string[];value:number}|null;metric:'hours'|'demands';icon:React.ReactNode;positive?:boolean}){return <article className={`spotlight ${positive?'positive':''}`}><div className="spotlight-top"><span className="spotlight-icon">{icon}</span><span>{title}</span></div><strong className="spotlight-number">{result?metric==='hours'?hours(result.value):number(result.value):'Sem dados'}</strong><span className="spotlight-unit">{metric==='hours'?'horas registradas':'demandas atribuídas'}</span><div className="spotlight-names">{result?.names.map(name=><span key={name}>{name}</span>)||<span>Nenhum valor disponível</span>}</div>{result&&result.names.length>1&&<small className="tie-label">Empate entre {result.names.length} integrantes</small>}</article>}
function PanelTitle({title,subtitle}:{title:string;subtitle:string}){return <div className="panel-title"><div><h2>{title}</h2><p>{subtitle}</p></div></div>}
function Empty({text}:{text:string}){return <div className="empty-chart"><BarChart3 size={28}/><p>{text}</p></div>}
function HorizontalChart({people,field}:{people:Member[];field:'hours'|'demands'}){
 const values=people.filter(p=>p[field]!=null).map(p=>({name:p.name,value:p[field]}));
 return values.length?<div className="bar-scroll"><ResponsiveContainer width="100%" height={Math.max(270,values.length*47)}><BarChart layout="vertical" data={values} margin={{left:5,right:25,top:12,bottom:10}}><CartesianGrid stroke="#2b2935" horizontal={false}/><XAxis type="number" stroke="#88838f" allowDecimals={field==='hours'} tick={{fontSize:12}}/><YAxis type="category" dataKey="name" width={105} stroke="#bbb3c4" tick={{fontSize:12}} tickFormatter={s=>s.length>17?s.slice(0,15)+'…':s} interval={0}/><Tooltip contentStyle={tooltipStyle} cursor={{fill:'#ffffff05'}} formatter={v=>field==='hours'?hours(Number(v)):`${number(Number(v))} demandas`}/><Bar dataKey="value" name={field==='hours'?'Horas registradas':'Demandas'} fill={field==='hours'?'#7C3AED':'#A3E635'} radius={[0,5,5,0]} barSize={19} isAnimationActive={false}/></BarChart></ResponsiveContainer></div>:<Empty text="Ainda não há valores registrados."/>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
