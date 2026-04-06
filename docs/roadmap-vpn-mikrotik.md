# Roadmap de VPN para Integracao MikroTik

Este documento descreve uma evolucao futura do projeto para proteger a comunicacao entre o MikroTik e a plataforma usando uma VPN, sem mudar o principio atual de manter o portal web publico em `HTTPS`.

## Objetivo

Separar os fluxos em dois planos:

- plano publico: captive portal, interface web, assets e endpoints acessados pelo usuario final
- plano privado: RADIUS, accounting, API de integracao com o MikroTik e acesso administrativo ao roteador

Modelo alvo:

- cliente do Wi-Fi acessa o portal por dominio publico
- MikroTik se conecta ao projeto por IP privado da VPN
- RADIUS, accounting e integracao ativa trafegam apenas pelo tunel

## Motivacao

- reduzir exposicao de portas sensiveis na internet
- simplificar controle de firewall por cliente e por roteador
- padronizar conectividade entre roteadores remotos e o servidor
- preparar a base para uma futura operacao multiempresa
- melhorar previsibilidade operacional em ambientes com roteadores espalhados

## Principios de arquitetura

- o portal web deve continuar acessivel publicamente em `HTTPS`
- o usuario do HotSpot nao deve depender da VPN para abrir a tela de login
- a VPN deve proteger a comunicacao entre roteador e plataforma
- o backend continua como fonte central de verdade
- a configuracao de VPN nao deve quebrar o modo atual sem VPN

## Escopo futuro

### Fase 1. Modelagem de dados

- adicionar campos de VPN em `Configuracoes` e `Roteadores`
- suportar modo `sem-vpn`, `wireguard` e `l2tp-ipsec`
- armazenar IP local e remoto do tunel
- armazenar porta, peers, redes permitidas e keepalive
- marcar se o RADIUS deve usar IP publico ou IP do tunel

### Fase 2. Gerador de scripts

- incluir seletor de topologia no gerador MikroTik
- gerar script `RouterOS v7` com `WireGuard`
- gerar script `RouterOS v6` com `L2TP/IPsec`
- ajustar automaticamente `src-address`, RADIUS e rotas para o IP da VPN
- gerar blocos separados para:
  - criacao do tunel
  - firewall
  - rotas
  - servicos de gestao
  - HotSpot e RADIUS

### Fase 3. Seguranca de gestao

- restringir `api`, `api-ssl`, `ssh` e `winbox` ao range da VPN
- preferir `api-ssl` quando a integracao ativa estiver habilitada
- bloquear gestao pela internet publica por padrao
- documentar exigencias minimas de senha, certificados e segredo compartilhado

### Fase 4. Operacao do servidor

- preparar WireGuard no servidor Ubuntu para roteadores `v7`
- preparar stack opcional de concentrador `L2TP/IPsec` para compatibilidade com `v6`
- incluir templates de firewall do host
- documentar roteamento, NAT, MTU e troubleshooting
- incluir health checks de tunel no runbook operacional

### Fase 5. Observabilidade

- mostrar status do tunel na UI
- distinguir `roteador offline`, `VPN offline` e `RADIUS offline`
- registrar ultimo handshake, latencia basica e ultimo accounting recebido
- adicionar alertas operacionais para perda de tunel

### Fase 6. Provisionamento por cliente

- permitir um perfil de conectividade por roteador
- suportar multiplos roteadores por operacao com sub-redes isoladas
- preparar a base para futura separacao por tenant

## Escolhas tecnicas recomendadas

### RouterOS v7

- preferir `WireGuard`
- usar peer por roteador
- usar `PersistentKeepalive` quando houver NAT
- limitar acesso de gestao ao range do tunel

### RouterOS v6

- usar `L2TP/IPsec` como modo de compatibilidade
- tratar esse caminho como legado
- manter documentacao clara de diferencas operacionais e de suporte

## Pros

- menor superficie de ataque
- isolamento da comunicacao sensivel
- enderecamento previsivel para RADIUS e API
- melhor base para operacao distribuida
- mais seguro para integracao ativa com o roteador

## Contras

- mais complexidade de implantacao e suporte
- maior numero de variaveis de rede para diagnosticar
- coexistencia de dois modelos por versao do RouterOS
- dependencia adicional do tunel para autenticacao e accounting
- mais pontos de falha em cenarios de conectividade ruim

## Riscos conhecidos

- erro de MTU ou MSS pode degradar autenticacao e navegacao
- falha de tunel derruba RADIUS e integracao ativa se nao houver fallback
- v6 e v7 aumentam custo de suporte
- configuracoes manuais em roteadores antigos tendem a gerar drift

## Fallback recomendado

- permitir operacao sem VPN no MVP
- manter uma flag por roteador para habilitar VPN apenas quando necessario
- prever rollback simples para RADIUS por IP publico controlado
- documentar um procedimento de emergencia para reabrir autenticacao

## Ordem recomendada de implementacao

1. modelagem de dados e UI para parametros de VPN
2. gerador de script `WireGuard` para `v7`
3. ajuste de RADIUS e integracao ativa para usar IP do tunel
4. health checks e status de tunel na UI
5. suporte `L2TP/IPsec` para `v6`
6. endurecimento operacional e runbooks

## Fora de escopo por enquanto

- auto provisionamento de certificados internos
- orquestracao completa de peers no servidor pela UI
- multi-tenant completo
- failover automatico entre VPN e IP publico

## Criterios para iniciar esta fase

- piloto single-company validado em producao
- fluxo atual de HotSpot + RADIUS estavel
- integracao ativa com MikroTik operando sem drift relevante
- runbook basico de incidentes consolidado
