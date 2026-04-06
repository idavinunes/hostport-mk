# ADR-001: Servidor Externo vs User Manager

## Status

Aceito.

## Contexto

O captive portal precisa operar com rastreabilidade, flexibilidade de regras de negocio, trilha de auditoria e possibilidade de evolucao da aplicacao administrativa.

O MikroTik User Manager resolveria parte da autenticacao, mas criaria forte acoplamento operacional com o roteador e reduziria a liberdade de evolucao do produto.

## Decisao

Usar MikroTik apenas como enforcement de rede e mover autenticacao, dados e regras para uma stack externa composta por FreeRADIUS, PostgreSQL e aplicacao propria.

## Consequencias

- Positivas:
  - maior auditabilidade
  - melhor governanca de dados
  - possibilidade de evolucao do painel e das regras
  - backup e restore centralizados
- Negativas:
  - mais componentes para operar
  - necessidade de manter integracao RADIUS com banco
  - exige disciplina de deploy e observabilidade

