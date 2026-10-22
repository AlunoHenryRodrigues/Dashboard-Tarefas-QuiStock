# QuiStock — Dashboard de desempenho

Aplicação React + TypeScript + Vite para analisar uma planilha Excel real. Interface em preto, roxo e verde-claro, responsiva, com Recharts e leitura local usando ExcelJS. Não inclui dados demonstrativos na aplicação. Os dados sintéticos de `tests/` e `src/data.test.ts` existem exclusivamente para testes.

## Executar e validar

Requer Node.js 22 ou 24 e npm. No diretório do projeto:

```sh
npm ci
npm run dev -- --port 5173
```

```sh
npm test
npm run test:e2e
npm run build
npm run preview -- --port 4173
```

Para os testes de navegador, o projeto usa `/usr/bin/chromium` quando disponível. Em outra máquina, execute `npx playwright install chromium` antes de `npm run test:e2e`. O Playwright inicia o Vite automaticamente se necessário. O build gera `dist/`.

## Executar no Windows / VS Code

Os arquivos criados no ambiente cloud precisam estar no seu computador antes da instalação. Extraia o pacote do projeto e abra a pasta que contém `package.json` e `package-lock.json` no VS Code. Se o Explorer estiver vazio, você ainda não está com os arquivos do projeto nessa pasta.

No PowerShell dessa pasta:

```powershell
Test-Path .\package.json
Test-Path .\package-lock.json
npm ci
npm run dev
```

Os dois primeiros comandos devem retornar `True`. Abra no navegador o endereço exibido pelo Vite. No Windows, não é necessário usar o cache `/tmp/quistock-npm`, que foi escolhido para o ambiente cloud Linux.

## Importação de Excel

1. No SharePoint/Excel, baixe uma cópia `.xlsx` atualizada. Não é necessário alterar a planilha original.
2. Importe o arquivo no site, ou arraste-o para a tela inicial. Limite: 20 MB, 50 mil linhas e 200 colunas por aba.
3. Confirme as abas de análises do 1º e 2º ano. O detector sugere nomes com “Análise” e identifica cabeçalhos comuns, mas **o mapeamento precisa ser conferido**. A aplicação não presume conhecer os cabeçalhos da planilha institucional.
4. Selecione a linha de cabeçalho, a turma e o tipo de base para cada aba. Use **uma única base por turma**, para evitar somar a aba de análises com os mesmos dados das abas operacionais.
5. Mapeie integrante, horas e quantidade de demandas. Se a aba for operacional, escolha “Uma demanda por linha” e mapeie ID, data e status quando disponíveis. Veja as primeiras linhas antes de confirmar.
6. Confirme a unidade: horas decimais (`2,5` = 2h30), duração Excel (`0,5` = 12h) ou minutos (`150` = 2h30). Textos `02:30`, `26:30`, `02:30:30` e `2h 30min` são durações. Não mapeie horário de entrada/saída como duração: o sistema não infere intervalos.
7. Clique em “Construir dashboard”. A origem, as abas e o horário da importação aparecem no topo. “Atualizar Excel” importa uma nova cópia. O botão ao lado da origem reabre o mapeamento.

Os registros ficam na memória da aba do navegador e são descartados ao recarregar/fechar. Não há upload para servidor, armazenamento persistente ou sincronização automática. A data exibida é a **data da importação**, não a data de alteração do documento no SharePoint. Arquivos inválidos não substituem o dashboard anterior.

## Perfil reconhecido do QuiStock.xlsx

O importador reconhece as abas `Análises - 1º` e `Análises - 2º ` (incluindo espaços no nome) e suas abas correspondentes `Tarefas - 1º` e `Tarefas  - 2º`.

- Nas análises, o cadastro é o bloco **F10:L15** (1º ano) e **F10:L16** (2º ano): “Nome”, situações e “Total”. A leitura termina no fim desse bloco; o seletor “Integrante” da linha 23 e painéis auxiliares não são pessoas.
- A coluna **V / Horas Trabalhadas** pertence à tabela **por matéria**, não à tabela por integrante. Ela é deliberadamente ignorada para calcular horas pessoais. A coluna D / Quantidade pertence ao resumo por situação e também não é usada como demanda individual.
- Nas tarefas, o cabeçalho fica na **linha 6**: A / Descrição, F / Horas Trabalhadas, D / Data de Conclusão, I / Status e as colunas de responsáveis J em diante. Cada descrição preenchida é uma demanda; células vazias e linhas de modelo não são demandas.
- As caixas de responsáveis são booleanas: somente as marcadas atribuem a demanda ao integrante. As horas de uma tarefa compartilhada são divididas igualmente entre os responsáveis. Cada responsável recebe uma participação e a demanda única é contada uma vez.
- O cadastro das análises é preservado mesmo sem tarefas: integrantes da turma vazia aparecem com zero horas registradas e zero demandas. Fórmulas sem resultado salvo não são presumidas como zero: as contagens são reconstruídas a partir das tarefas, cuja existência e atribuições são verificáveis.
- A tabela de pessoas e as caixas são conferidas entre si. Se houver divergência entre totais salvos de análises e as linhas de tarefas, é exibido um aviso e as contagens operacionais são usadas, mantendo os filtros consistentes.
- Textos como `1h` e `30 minutos` são reconhecidos, além dos demais formatos de duração. Uma célula de horas vazia não vira zero. **Somente neste perfil operacional verificado**, subtotais de horas conhecidas são mostrados com aviso explícito de **parcial** e contagem de demandas sem horas. Pessoas com tarefas, mas nenhuma hora conhecida, continuam com “Sem dados”.
- Demandas sem responsável entram no total da turma e são sinalizadas, mas não criam uma pessoa fictícia no ranking. Horas conhecidas sem responsável, se existirem em futuras versões, entram no total e não no gráfico de pessoas; a diferença fica indicada no aviso de atribuição.
- O período usa **Data de Conclusão**, nunca Prazo como se fosse data de trabalho. Registros sem conclusão são excluídos ao aplicar um período.

A planilha fornecida pelo usuário foi usada para validação local, sem ser adicionada ao repositório ou ao build. O site continua exigindo importação manual: não há arquivo institucional embutido.

Para repetir o teste com uma cópia local (PowerShell):

```powershell
$env:QUISTOCK_TEST_XLSX = "C:\caminho\QuiStock.xlsx"
npm run test:e2e
```

Sem essa variável, somente esse teste específico é pulado; os demais testes usam dados sintéticos.

## Cálculos e limites

- Resumo por integrante: soma horas e contagens das linhas de cada pessoa. Contagens são **participações individuais**, pois não é possível inferir demandas únicas a partir de totais por pessoa. Confira se nomes repetidos representam parcelas distintas, e não duplicação do mesmo resumo.
- Base operacional: cada linha é uma demanda; uma coluna de ID é opcional. IDs repetidos na mesma aba/turma interrompem a importação, para impedir dupla contagem. Sem ID, linhas distintas são demandas distintas.
- Responsáveis separados por `;` ou quebra de linha recebem uma participação cada. As horas da demanda são divididas igualmente entre os responsáveis. A soma das horas permanece igual ao total da linha; a demanda única é contada uma vez. Essa metodologia deve ser adequada à base escolhida: se a planilha já guarda horas individuais em linhas distintas, não use um ID compartilhado sem consolidar a informação corretamente.
- Na visão geral de bases exclusivamente operacionais, o total é a quantidade de IDs/linhas únicos, com namespace de aba e turma. Demandas equivalentes entre turmas não são deduplicadas por inferência. Na combinação de bases agregadas e operacionais, o indicador é explicitamente participações.
- Normalização de nomes: maiúsculas/minúsculas, acentos e espaços. Turmas diferentes permanecem separadas. Homônimos na mesma turma precisam ser diferenciados na fonte, por exemplo com nome completo; não há tentativa de inferir identidades.
- Totais, subtotais, média e soma identificáveis na coluna de integrante são ignorados. Confira a amostra e não inclua rodapés com outros rótulos na base.
- Ausência é `null`; zero é um valor válido. No modo genérico, totais e médias com parcelas ausentes ficam “Sem dados”. O perfil QuiStock usa subtotais registrados e identifica explicitamente os resultados parciais, conforme descrito acima. Gráficos mostram somente parcelas conhecidas. Avisos ficam em “Origem dos dados e metodologia de cálculo”.
- Fórmulas: lê o resultado calculado salvo no Excel. O navegador não recalcula fórmulas; se não houver resultado em cache, recalcule e salve no Excel antes da importação.
- Empates aparecem nos destaques e compartilham posição no ranking. O ranking inclui todos os integrantes válidos identificados, inclusive zero horas/demandas.
- Filtros, inclusive a pesquisa por nome, afetam indicadores, gráficos e ranking. Filtros de período/status são exibidos somente para registros operacionais com esses campos. Ao aplicá-los, registros sem a respectiva informação são excluídos; as médias usam os integrantes restantes na seleção, não um cadastro externo ausente do arquivo.
- Período usa datas de atividades, não data de importação. Datas brasileiras, ISO, seriais Excel e células de data são suportadas. A evolução é omitida quando não há datas reais.
- O CSV contém o ranking filtrado, com números brasileiros e proteção contra fórmulas em nomes.

## Fonte institucional e integração futura

Link de referência:

https://institutogerminare-my.sharepoint.com/:x:/g/personal/nathalia_20260222_institutojef_org_br/IQCImp76PNjiSKd6B3eYupG2AZHD3QzTC68HcBN23Dyu-DA?e=Zuoykt

A requisição ao link SharePoint retornou **403 do proxy de rede**, antes de acessar o documento. Isso não comprova se o compartilhamento é público ou privado. Posteriormente, o usuário forneceu `QuiStock.xlsx`, permitindo analisar as abas, tabelas, fórmulas e campos reais e implementar o perfil descrito acima. O arquivo institucional não foi publicado nem incluído no projeto. Não houve alteração do Excel original.

Microsoft Graph é uma via viável em princípio, mas não foi habilitada ou testada com esse documento. Um link compartilhado não equivale a uma API pública nem garante download com CORS. Para sincronizar será necessário:

- Confirmar com a instituição o acesso permitido, tenant e aplicação registrada no Microsoft Entra ID, além dos escopos mínimos aplicáveis à biblioteca/documento e consentimento institucional.
- Usar OAuth autorizado pela instituição. Para a arquitetura sem login próprio, um backend/função serverless deve obter o documento com acesso autorizado, manter credenciais em variáveis seguras do servidor e validar quem pode consultar os dados. Não tornar uma planilha privada pública por meio de um endpoint anônimo.
- Resolver a referência do arquivo para `driveId` e `itemId` com Graph e obter o conteúdo via `/drives/{drive-id}/items/{item-id}/content`. Alternativamente, avaliar os endpoints `/shares/{shareId}/driveItem` respeitando autenticação e regras institucionais. Documentação: https://learn.microsoft.com/graph/api/driveitem-get-content e https://learn.microsoft.com/graph/api/shares-get.
- Acrescentar um adaptador de origem que entregue os bytes a `readWorkbook`, e então `parseSheets`, com o mapeamento confirmado para a fonte real. As funções de dados em `src/data.ts` não dependem da interface ou de autenticação. Os componentes usam `Dataset`, independentemente da origem.
- Somente exibir “sincronizado” após implementar e verificar atualização, cache, falhas, permissões e data da fonte. Nunca inserir tokens, senhas ou client secrets em variáveis `VITE_*` ou no frontend.

## Publicar

- **Vercel:** importar este repositório, preset Vite, comando `npm run build`, diretório `dist`. Se o repositório for importado em um workspace maior, selecione esta pasta como raiz.
- **Netlify:** build `npm run build`, publish directory `dist`.
- **GitHub Pages:** compilar com Node.js e publicar o conteúdo de `dist` pelo GitHub Actions/Pages. O `base: './'` permite servir sob o caminho do repositório. O site não usa rotas de servidor; os parâmetros de consulta funcionam ao acessar diretamente a URL.

A URL pública só existe depois da implantação. A importação manual funciona em hospedagem estática, sem serviços pagos, sem banco de dados e sem segredos. Não foi realizada uma publicação externa automaticamente.

Visualizações diretas:

- `https://SEU-DOMINIO/?turma=geral`
- `https://SEU-DOMINIO/?turma=1ano`
- `https://SEU-DOMINIO/?turma=2ano`

Substitua `SEU-DOMINIO` pela URL pública real. Ao abrir o site, cada usuário importa sua cópia do Excel; dados privados não são embutidos no build.

## Botão “Visualizar Dashboard” no Excel

1. Depois da publicação, copie a URL pública.
2. No Excel, selecione uma célula ou forma com o texto **Visualizar Dashboard**. Use **Inserir → Link** (ou `Ctrl+K`) e cole a URL. As versões web podem limitar links em formas: use uma célula com hiperlink nesse caso.
3. Opcionalmente, use uma fórmula com separador brasileiro: `=HIPERLINK("https://SEU-DOMINIO/?turma=geral";"Visualizar Dashboard")`.
4. No Excel para a Web, um link externo normalmente abre outra aba. Esse comportamento depende do Excel/navegador; fórmulas e links de células não permitem definir `target="_blank"`. Se necessário, use a opção do navegador **Abrir link em nova aba**. No Excel desktop, o link abre no navegador padrão.

O site é independente do Excel. Não depende de caminhos locais. A planilha original não foi modificada.

## Organização

- `src/data.ts`: leitura XLSX, mapeamento, duração, normalização, métricas e contratos de dados.
- `src/main.tsx`: dashboard, filtros, gráficos, importador, ranking e painéis.
- `src/style.css`: identidade QuiStock, responsividade e acessibilidade de movimento.
- `src/data.test.ts`: testes de importação e cálculos.
- `tests/dashboard.spec.ts`: testes de navegador para importação, filtros, turmas, ranking e layout.
