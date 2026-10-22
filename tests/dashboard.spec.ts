import {test,expect} from '@playwright/test';
import ExcelJS from 'exceljs';
// Fixture sintética, gerada apenas para validar a importação; não vai para o site.
async function fixture(){const wb=new ExcelJS.Workbook();const a=wb.addWorksheet('Análises 1º ano');a.addRow(['Integrante','Horas','Demandas']);a.addRow(['Pessoa teste A',4,2]);a.addRow(['Pessoa teste B',0,0]);a.addRow(['Total',4,2]);const b=wb.addWorksheet('Análises 2º ano');b.addRow(['Nome','Horas trabalhadas','Quantidade de demandas']);b.addRow(['Pessoa teste C',2,1]);b.addRow(['Pessoa teste D',2,1]);return Buffer.from(await wb.xlsx.writeBuffer())}
async function importData(page:import('@playwright/test').Page){await page.locator('input[type=file]').setInputFiles({name:'fixture-teste.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:await fixture()});await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Construir dashboard'}).click();await expect(page.getByRole('dialog')).not.toBeVisible()}
test('importação, cálculos, filtros, turmas, ranking e detalhes',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?turma=geral');await expect(page.getByText('O próximo insight está')).toBeVisible();await expect(page.locator('.kpi')).toHaveCount(0);
 await importData(page);await expect(page.locator('.kpi').first()).toContainText('8 h');await expect(page.locator('.kpi').nth(1)).toContainText('4');await expect(page.locator('.ranking tbody tr')).toHaveCount(4);
 await page.getByRole('button',{name:'Dashboard · 1º ano',exact:true}).click();await expect(page).toHaveURL(/turma=1ano/);await expect(page.locator('.kpi').first()).toContainText('4 h');await expect(page.locator('.ranking tbody tr')).toHaveCount(2);await expect(page.locator('.leader').nth(2)).toContainText('Pessoa teste B');
 await page.getByLabel('Integrante', {exact:true}).selectOption({label:'Pessoa teste B · 1º ano'});await expect(page.locator('.kpi').first()).toContainText('0 h');await expect(page.locator('.ranking tbody tr')).toHaveCount(1);
 await page.getByRole('button',{name:'Limpar',exact:true}).click();await page.getByLabel('Pesquisar integrante').fill('teste A');await expect(page.locator('.ranking tbody tr')).toHaveCount(1);await expect(page.locator('.kpi').first()).toContainText('4 h');
 await page.getByRole('button',{name:'Pessoa teste A',exact:false}).first().click();await expect(page.getByRole('dialog')).toContainText('Registros disponíveis na base');await page.getByRole('button',{name:'Fechar painel'}).click();
 await page.getByRole('button',{name:'Dashboard · 2º ano',exact:true}).click();await expect(page.locator('.leader').first()).toContainText('Pessoa teste C, Pessoa teste D');await expect(page.locator('.ranking tbody tr')).toHaveCount(2);
await page.getByRole('button',{name:'Decrescente',exact:true}).click();await expect(page.getByRole('button',{name:'Crescente',exact:true})).toBeVisible();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar CSV'}).click();expect((await download).suggestedFilename()).toBe('quistock-ranking.csv');
 expect(errors).toEqual([]);
});
test('celular, importação e layout sem overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/?turma=2ano');await expect(page.getByRole('heading',{level:1})).toContainText('2º ano');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'/tmp/quistock-empty-mobile.png',fullPage:true});await importData(page);await expect(page.locator('.kpi').first()).toContainText('4 h');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'/tmp/quistock-dashboard-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'Visão geral',exact:true}).click();await page.screenshot({path:'/tmp/quistock-dashboard-desktop.png',fullPage:true});
});
test('base operacional: demandas únicas, status, período e erro sem perder dados',async({page})=>{
 const wb=new ExcelJS.Workbook();const ws=wb.addWorksheet('Atividades 1º ano');ws.addRow(['Responsável','Horas','ID','Data','Status']);ws.addRow(['Teste A; Teste B',4,'D1','01/10/2026','Concluída']);ws.addRow(['Teste A',2,'D2','02/10/2026','Aberta']);
 await page.goto('/');await page.locator('input[type=file]').setInputFiles({name:'operacional-teste.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(await wb.xlsx.writeBuffer())});
 await page.locator('.mapping-grid label').filter({hasText:'Estrutura'}).locator('select').selectOption('tasks');await page.getByRole('button',{name:'Construir dashboard'}).click();
 await expect(page.locator('.kpi').first()).toContainText('6 h');await expect(page.locator('.kpi').nth(1)).toContainText('Total de demandas');await expect(page.locator('.kpi').nth(1).locator('strong')).toHaveText('2');await expect(page.getByText('Evolução das atividades',{exact:true})).toBeVisible();
 await page.getByLabel('Status',{exact:true}).selectOption('Concluída');await expect(page.locator('.kpi').first()).toContainText('4 h');await expect(page.locator('.kpi').nth(1).locator('strong')).toHaveText('1');
 await page.getByRole('button',{name:'Limpar',exact:true}).click();await page.getByLabel('De',{exact:true}).fill('2026-10-02');await expect(page.locator('.kpi').first()).toContainText('2 h');await expect(page.locator('.ranking tbody tr')).toHaveCount(1);
 await page.locator('input[type=file]').setInputFiles({name:'invalido.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from('not a workbook')});await expect(page.getByRole('alert')).toBeVisible();await expect(page.locator('.kpi').first()).toContainText('2 h');
});

test('QuiStock com a planilha fornecida: importação sem dados fictícios',async({page})=>{
 const file=process.env.QUISTOCK_TEST_XLSX;
 test.skip(!file,'Defina QUISTOCK_TEST_XLSX para validar uma cópia local da planilha institucional. O arquivo não é distribuído no repositório.');
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.locator('input[type=file]').setInputFiles(file!);
 await expect(page.getByText('QuiStock reconhecido',{exact:false})).toHaveCount(2);
 await expect(page.locator('.mapping-grid').first().getByText('Unidade dos valores numéricos')).toBeVisible();
 await page.getByRole('button',{name:'Construir dashboard'}).click();
 await expect(page.getByRole('dialog')).not.toBeVisible();
 await expect(page.locator('.kpi').first()).toContainText('64,5 h');await expect(page.locator('.kpi').first()).toContainText('parcial');
 await expect(page.locator('.kpi').nth(1).locator('strong')).toHaveText('29');
 await expect(page.locator('.ranking tbody tr')).toHaveCount(11);
 await expect(page.getByRole('status')).toContainText('15 demandas');await expect(page.getByRole('status')).toContainText('1 demanda(s) sem responsável');
 await page.getByRole('button',{name:'Dashboard · 1º ano',exact:true}).click();
 await expect(page.locator('.ranking tbody tr')).toHaveCount(5);await expect(page.locator('.kpi').first()).toContainText('64,5 h');
 await page.getByLabel('Status',{exact:true}).selectOption('Concluída');await expect(page.locator('.kpi').first()).toContainText('18,5 h');await expect(page.locator('.kpi').nth(1).locator('strong')).toHaveText('14');
 await page.getByRole('button',{name:'Dashboard · 2º ano',exact:true}).click();await expect(page.locator('.ranking tbody tr')).toHaveCount(6);
 await expect(page.locator('.kpi').first().locator('strong')).toHaveText('0 h');await expect(page.locator('.kpi').nth(1).locator('strong')).toHaveText('0');
 expect(errors).toEqual([]);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
