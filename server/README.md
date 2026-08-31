# zalike-erp-bridge

Microsserviço ponte entre o padronizador de pedidos (frontend na Skip) e o
MySQL externo `zalike_ia`. Existe só para que a credencial do banco nunca
precise chegar ao navegador: o frontend chama este serviço por HTTPS, e só
ele fala diretamente com o MySQL.

## Por que este serviço é separado do resto do projeto

O frontend roda hospedado pela própria Skip (`*.goskip.dev`), numa
infraestrutura compartilhada cujo IP de saída vocês não controlam nem
conhecem de antemão. O MySQL externo bloqueia o IP de origem depois de 5
tentativas com credencial errada — então a conexão com ele precisa sair de
um lugar com IP estável, que o time de rede da Zalike possa liberar
explicitamente no firewall. Por isso este serviço deve ser implantado à
parte (uma VPS pequena, um container em Fly.io/Railway/Render, um servidor
interno da empresa — qualquer lugar com IP de saída fixo e conhecido).

## Como rodar

```bash
cd server
npm install
cp .env.example .env
# edite .env com host/porta/usuário/senha reais do MySQL, uma API_KEY forte
# gerada por vocês, e a URL pública do frontend em ALLOWED_ORIGIN
npm run build
npm start
```

Para desenvolvimento local com reload automático: `npm run dev`.

## Antes de colocar em produção

- **Troque a senha do MySQL.** A que está documentada no chat de
  desenvolvimento deste projeto foi compartilhada em texto puro — rotacione
  antes do deploy real.
- **Confirme que o usuário `pedido_padrao` só tem permissão de leitura**
  (`SELECT`) nas tabelas necessárias (`t_cliente`, `t_clientes_formapagto`,
  `t_formapagto`, `t_vendedor`, `t_codbarra`, `t_produto`,
  `t_convenio_codigo_no_cliente`). Esse serviço nunca precisa escrever no
  banco.
- **Peça para liberar o IP de saída do serviço no firewall do MySQL.**
- **Gere uma `API_KEY` forte** (`openssl rand -hex 32`, por exemplo) e
  configure o mesmo valor em `VITE_ERP_API_KEY` no frontend — de preferência
  via variável de ambiente da hospedagem, não commitada em `.env`.
- A chave de API só impede abuso casual — qualquer pessoa com acesso ao
  bundle JS público do frontend consegue extraí-la (variáveis `VITE_*` são
  sempre embutidas no código que roda no navegador). Ela não é um
  substituto de autenticação real de usuário. Quando o login do sistema
  deixar de ser mock, o ideal é trocar essa checagem em
  `src/middleware/auth.ts` para validar o token de sessão do PocketBase.

## Endpoints

Todos exigem o header `x-api-key` (quando `API_KEY` está configurada).

- `GET /health` — sem autenticação; devolve o estado do circuit breaker.
- `GET /cliente?cnpj=...` — Fluxo 1. `200` com
  `{ found, idCliente, idConvenio, formaPagtoCodigo, formaPagtoDescricao, repCode }`,
  ou `404 { found: false }` se o CNPJ não estiver na base (lembrando: a
  sincronização com o servidor local roda 1x/dia entre 07h–08h, então pode
  haver defasagem de até 24h).
- `GET /produto?idCliente=...&valor=...` — Fluxo 2. `200` com
  `{ found, produtoCodigo }`, ou `404 { found: false }`.
- Qualquer falha de conexão com o MySQL responde `502`/`503` — o frontend
  trata isso como "não encontrado" e deixa o campo para preenchimento
  manual, sem travar o fluxo do usuário.

## Sobre o circuit breaker (`src/db.ts`)

O pool de conexão é criado uma única vez, na subida do processo. Se 3
falhas de conexão acontecerem em sequência, o serviço para de tentar por 5
minutos antes de tentar de novo — isso existe especificamente para não
correr o risco de bater no limite de 5 tentativas do firewall do MySQL. O
processo também nunca é derrubado por erro de banco (sem `process.exit`),
porque um restart automático recriaria o pool do zero — na prática, um
retry disfarçado.
