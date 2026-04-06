# Template HTML para HotSpot MikroTik

Este projeto agora inclui um pacote base de arquivos HTML/CSS para personalizar o HotSpot do MikroTik e manter a identidade visual da solucao em um unico fluxo.

Arquivos disponiveis em:

`mikrotik/hotspot-template/`

## O que este pacote resolve

- tela de login com identidade visual unica
- tela inicial de redirecionamento do HotSpot
- tela de erro de login sem cair no HTML padrao do RouterOS
- tela de status de sessao
- tela de logout
- `api.json` para captive portal detection em RouterOS v7

## Limite atual do MVP

O pacote de HotSpot resolve o front-end do login no MikroTik, mas **nao cria sozinho um cadastro publico completo**.

No estado atual do projeto:

- clientes continuam sendo cadastrados manualmente no painel administrativo
- vouchers continuam sendo criados no painel administrativo
- o HTML do HotSpot serve para login, orientacoes, branding e organizacao da experiencia

Se a operacao precisar de autoatendimento real, o proximo incremento deve incluir:

- uma pagina publica de cadastro fora do admin
- endpoint publico no backend para receber esses dados
- liberacao desse dominio no `walled-garden`
- ajuste do fluxo para gravar o novo cliente antes da autenticacao

## Como instalar no CHR ou em um MikroTik fisico

1. Crie o HotSpot normalmente no roteador.
2. No RouterOS, confirme que existe o diretorio padrao `hotspot`.
3. Copie o diretorio `hotspot` do roteador para sua maquina via `Files`, `FTP`, `SFTP` ou `WebFig`.
4. Sobrescreva os arquivos desejados com os arquivos desta pasta:
   - `redirect.html`
   - `login.html`
   - `rlogin.html`
   - `flogin.html`
   - `alogin.html`
   - `rstatus.html`
   - `status.html`
   - `logout.html`
   - `api.json`
   - `styles.css`
5. Envie o diretorio de volta para o roteador com um nome proprio, por exemplo `hotspot-hostport`.
6. Aponte o profile do HotSpot para esse diretorio customizado.

Dependendo da versao/interface do RouterOS, isso pode aparecer como `html-directory` ou como `html-directory-override`.

Exemplo:

```routeros
/ip hotspot profile set [find name="hsprof-academia"] html-directory=hotspot-hostport
```

Em alguns equipamentos com armazenamento em flash separado, o caminho pode precisar ficar assim:

```routeros
/ip hotspot profile set [find name="hsprof-academia"] html-directory=/flash/hotspot-hostport
```

Em algumas builds, o mesmo ajuste pode aparecer com o campo de override:

```routeros
/ip hotspot profile set [find name="hsprof-academia"] html-directory-override=/flash/hotspot-hostport
```

## Requisito importante

Este template foi preparado para o fluxo adotado neste projeto:

```routeros
login-by=http-pap
```

Se o profile estiver em `http-chap` apenas, este HTML vai avisar que o profile esta fora do esperado.

## Personalizacao recomendada antes do upload

Edite os textos em `login.html` e `flogin.html` para trocar:

- nome comercial da operacao
- instrucao de suporte
- mensagem de primeiro acesso
- orientacao de cadastro manual ou autoatendimento futuro

## Captive portal detection

O `api.json` foi alinhado ao comportamento esperado nas versoes recentes do RouterOS v7. Se o HotSpot tiver sido criado em versoes antigas, vale resetar o HTML base antes de aplicar o pacote customizado.

Referencias oficiais:

- https://help.mikrotik.com/docs/spaces/ROS/pages/87162881/Hotspot%20customisation
- https://help.mikrotik.com/docs/spaces/ROS/pages/56459266/HotSpot%2B-%2BCaptive%2Bportal
