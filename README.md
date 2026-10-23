# QuiStock — desempenho dos integrantes

Dashboard somente de visualização com **duas páginas: 1º ano e 2º ano**. O visitante escolhe a turma e vê todos os resultados. Não há importador, configuração de colunas, filtros ou telas de mapeamento.

Cada página apresenta:

- Horas registradas, total de demandas, número de integrantes e média de horas.
- Big Numbers com quem teve mais e menos demandas e quem registrou mais e menos horas, incluindo empates.
- Gráficos de horas e demandas por integrante, distribuição de horas e lista completa da turma.
- Ranking completo, com layout adaptado ao celular.
- Aviso claro quando existem tarefas sem horas. Os valores são registros parciais, nunca uma estimativa de horas ausentes.

## Abrir no computador — configuração única do responsável

1. Extraia o projeto e abra no VS Code a pasta que contém `package.json`.
2. Coloque sua planilha com o nome **`QuiStock.xlsx` nessa mesma pasta**, ao lado de `package.json`. Também é aceita a pasta `dados/QuiStock.xlsx` (que tem prioridade).
3. No terminal dessa pasta, execute um comando por vez:

```powershell
npm ci
npm run dev
```

Abra o endereço exibido pelo Vite. O dashboard já abre preenchido; basta alternar entre **1º ano do Ensino Médio** e **2º ano do Ensino Médio**. Requer Node.js 22/24 e npm.

Quem acessa o dashboard não precisa importar a planilha. A colocação do Excel na pasta é feita uma única vez por quem mantém o site. Para atualizar os resultados no desenvolvimento, substitua essa cópia pelo Excel mais recente: o Vite recarrega os dados. A planilha institucional não é modificada.

As cópias Excel são ignoradas pelo Git e não acompanham o ZIP do GitHub. No ambiente de desenvolvimento desta tarefa, a planilha enviada pelo usuário já foi conectada localmente para validação. **Essa cópia local não é transferida automaticamente ao computador do usuário.**

## Fonte e cálculos

A leitura é automática para o formato do `QuiStock.xlsx` fornecido:

- `Análises - 1º` + `Tarefas - 1º`.
- `Análises - 2º ` + `Tarefas  - 2º` (espaços nos nomes são tolerados).
- Nas análises, o cadastro está no bloco **Nome / Total**, cabeçalho na linha 10: F10:L15 no 1º ano e F10:L16 no 2º ano. A leitura para no fim da tabela; o seletor da linha 23 não vira integrante.
- **Horas Trabalhadas** na coluna V das análises pertence à tabela **por matéria**. Essa coluna não é usada como se contivesse horas por pessoa. Quantidades do resumo por situação e painéis auxiliares também não entram nos números individuais.
- Nas tarefas, a linha 6 contém: A / Descrição, F / Horas Trabalhadas, D / Data de Conclusão, I / Status e J em diante / integrantes com caixas de responsáveis.
- Cada descrição preenchida é uma demanda. Linhas vazias do modelo e fórmulas de status em linhas sem descrição não são demandas.
- As caixas marcadas atribuem uma participação ao integrante. Uma demanda compartilhada vale uma demanda para a turma e uma participação para cada responsável. As horas da linha são divididas igualmente entre seus responsáveis; por isso, a soma das participações pode superar o total de demandas.
- Integrantes cadastrados sem tarefas continuam no ranking com zero horas registradas e zero demandas.
- Campos de horas vazios permanecem ausentes. O perfil QuiStock soma as horas efetivamente registradas e mostra explicitamente os resultados parciais. Uma pessoa com tarefas, mas nenhuma hora conhecida, fica com “Sem dados”, em vez de receber zero inventado.
- Demandas sem responsável entram no total da turma e são indicadas no rodapé, sem criar uma pessoa fictícia no ranking. Se tiverem horas, elas entram no total da turma e ficam fora da distribuição individual.
- Durações como `1h`, `30 minutos`, `02:30`, minutos numéricos e duração Excel são tratadas pela camada de dados. O perfil específico desta planilha interpreta números como horas, conforme o formato observado `0"h"`.
- Resultados salvos de fórmulas podem ser lidos, mas o navegador não recalcula o Excel. As contagens do perfil são verificadas/reconstruídas pelas linhas de tarefas e pelos responsáveis, sem somar análises e tarefas em duplicidade.
- Nomes são normalizados por espaços, acentos e maiúsculas dentro de cada turma; as duas turmas permanecem separadas. Empates aparecem com todos os nomes e compartilham posição no ranking.

## Atualização e SharePoint

O link SharePoint retornou HTTP 403 do proxy durante a investigação. O usuário forneceu depois uma cópia `QuiStock.xlsx`, que permitiu verificar as tabelas e corrigir a leitura. Não há sincronização automática com o SharePoint nem login próprio.

No desenvolvimento, a fonte é a cópia local do Excel. A data exibida é a data de modificação dessa cópia, não uma data de sincronização institucional. No build, o Vite lê o arquivo no servidor de desenvolvimento e gera os dados calculados para a aplicação estática. O arquivo Excel original não é disponibilizado como asset público.

Uma integração automática futura com Microsoft Graph depende de registro de aplicação, permissões e consentimento da instituição. Credenciais precisam ficar no servidor, nunca no frontend. A interface não depende da origem dos dados: `src/data.ts` fornece o contrato `Dataset`.

## Publicar no GitHub Pages

```powershell
npm run deploy:pages
```

O comando exige uma cópia da planilha em `dados/QuiStock.xlsx` (ou `QuiStock.xlsx` ao lado de `package.json`), gera o site e publica a pasta compilada `site/` na branch `codex/quistock-dashboard`, configurada como origem do GitHub Pages deste repositório. O arquivo Excel original não é enviado ao GitHub. É necessário ter acesso de escrita ao repositório no GitHub e executar o comando dentro da pasta clonada, não em uma pasta ZIP.

Endereço público: `https://alunohenryrodrigues.github.io/Dashboard-Tarefas-QuiStock/`.

Quando a planilha do SharePoint mudar, baixe uma cópia atualizada, substitua `dados/QuiStock.xlsx` no projeto e execute `npm run deploy:pages` outra vez. A tela local de desenvolvimento recarrega ao substituir o arquivo, mas o site público só muda depois da nova publicação. O GitHub Pages pode levar alguns minutos para exibir os novos dados. Não há sincronização direta com o SharePoint.

O site público exibe os nomes e indicadores calculados, e o arquivo Excel completo permanece fora dos assets públicos.

URLs diretas:

- `https://alunohenryrodrigues.github.io/Dashboard-Tarefas-QuiStock/?turma=1ano`
- `https://alunohenryrodrigues.github.io/Dashboard-Tarefas-QuiStock/?turma=2ano`

Sem parâmetro, abre o 1º ano. Não há página de visão geral combinando as turmas. O site usa base relativa e funciona sob o caminho de um repositório no GitHub Pages.

## Link no Excel

No Excel, selecione uma célula, escreva **Visualizar Dashboard**, use **Inserir → Link** e cole a URL pública com `?turma=1ano` ou `?turma=2ano`. O Excel na web costuma abrir links externos em uma nova aba; o comportamento final depende do navegador.

Alternativa no Excel em português:

```text
=HIPERLINK("https://alunohenryrodrigues.github.io/Dashboard-Tarefas-QuiStock/?turma=1ano";"Visualizar Dashboard")
```

A abertura em nova aba depende do Excel/navegador. A planilha original não é modificada pelo dashboard.

## Validar

```powershell
npm test
npm run test:e2e
npm run build
```

Os testes de navegador geram uma planilha sintética temporária exclusivamente para teste, fora do projeto. Eles verificam abertura já preenchida, ausência de controles de configuração, separação de turmas, indicadores, URLs, histórico, recarga e layout móvel. O Playwright usa `/usr/bin/chromium` quando disponível; em outra máquina, execute `npx playwright install chromium` uma vez.

Para testar com a própria cópia institucional:

```powershell
$env:QUISTOCK_TEST_XLSX = "C:\caminho\QuiStock.xlsx"
npm run test:e2e
```

`QUISTOCK_WORKBOOK` pode indicar outro caminho de fonte na máquina de desenvolvimento/build. Sem essa variável, a prioridade é `dados/QuiStock.xlsx`, depois `QuiStock.xlsx` na raiz.

## Arquivos principais

- `src/main.tsx`: duas páginas de visualização, Big Numbers, gráficos e rankings.
- `src/data.ts`: leitura XLSX, detecção das abas, normalização e cálculos.
- `src/style.css`: identidade QuiStock e layout responsivo.
- `vite.config.ts`: leitura da planilha na máquina de desenvolvimento/build.
- `tests/dashboard.spec.ts`: testes de navegação e apresentação dos resultados.
