# LGPD e Privacidade

## Objetivo

Estabelecer o tratamento minimo de dados pessoais para autenticacao de acesso Wi-Fi, segregando obrigacoes de acesso e consentimento opcional de marketing.

## Dados tratados

- nome completo
- CPF
- telefone
- email
- MAC address
- IP local
- horario de inicio e fim de sessao
- NAS e identificadores do roteador
- aceite de termos
- opt-in de marketing

## Principios aplicados

- finalidade: dados usados para cadastro, autenticacao e registros de conexao
- necessidade: nao armazenar conteudo de navegacao
- adequacao: marketing separado do acesso a rede
- seguranca: criptografia aplicacional de CPF e MAC
- responsabilizacao: trilha de auditoria de operacoes administrativas

## Pontos que exigem validacao juridica

- VALIDAR COM JURIDICO: uso de CPF como identificador forte
- VALIDAR COM JURIDICO: prazo exato de retencao por tipo de dado
- VALIDAR COM JURIDICO: texto final de Termos de Uso e Politica de Privacidade

## Medidas tecnicas previstas

- hash para busca de CPF e MAC
- ciphertext para leitura controlada
- JWT para autenticacao administrativa
- mascaramento de dados sensiveis na interface
- auditoria de alteracoes administrativas

