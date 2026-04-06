# Politica de Retencao

## Proposta inicial

- `radacct`: 12 meses
- `audit_logs`: 12 meses
- clientes inativos: revisar apos 12 meses sem uso
- backups: 30 dias online

## Regras operacionais

- snapshots diarios do PostgreSQL
- restore validado periodicamente
- exclusao controlada de backups vencidos

## Observacao

Os prazos acima sao sugestoes tecnicas iniciais. VALIDAR COM JURIDICO antes de producao.

