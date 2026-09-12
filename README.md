# Garagem Zero 🔧

Painel de manutenção de carro, inspirado no fluxo de apps como o AutoZelo: cadastro do veículo, histórico de manutenções por categoria, painel com saúde do carro (0–100), sistema de nível/pontos e lembretes do que está vencendo.

100% front-end (HTML + CSS + JS puro, sem build). Os dados ficam salvos no `localStorage` do navegador de quem está usando.

## Rodando localmente

Não precisa de instalação. Duas opções:

1. Abra `index.html` direto no navegador.
2. Ou sirva a pasta com qualquer servidor estático, por exemplo:

   ```bash
   npx serve .
   ```

## Publicando no GitHub Pages

1. Crie um repositório e suba estes arquivos.
2. Em **Settings → Pages**, escolha a branch `main` e a pasta raiz (`/`).
3. O app fica disponível em `https://<seu-usuario>.github.io/<repo>/`.

## Estrutura

```
garagem-zero/
├── index.html        # telas de onboarding e painel
├── assets/
│   ├── style.css      # tema "painel de instrumentos"
│   └── app.js         # estado, cálculo de vencimentos, persistência
└── README.md
```

## Como funciona

- **Onboarding (2 passos):** dados do carro (modelo, ano, km) e depois o histórico de manutenções, organizado em 4 categorias (Óleo & Filtros, Pneus/Freios & Suspensão, Motor & Elétrica, Outros). Pode pular o que não souber.
- **Painel:** mostra o carro, um medidor de saúde (calculado a partir de quantos itens estão em dia, perto do vencimento ou vencidos), nível do motorista com pontos, lembretes dos itens mais urgentes, e a lista completa de manutenções por categoria.
- **Cálculo de vencimento:** cada item tem um intervalo em km e/ou em meses. O status (em dia / atenção / vencido) é o pior entre os dois critérios.
- **Pontos:** ganhar pontos ao atualizar km, marcar manutenções feitas ou cadastrar uma manutenção personalizada — sobe de nível conforme acumula.

## Personalizando

- Catálogo padrão de manutenções e seus intervalos: `CATALOG` no topo de `assets/app.js`.
- Níveis e pontuação necessária: `LEVELS` em `assets/app.js`.
- Cores e tipografia: variáveis no topo de `assets/style.css`.

## Próximos passos sugeridos

- Múltiplos veículos por usuário.
- Exportar/importar histórico (JSON).
- Sincronização em nuvem (hoje é só local, por navegador).
