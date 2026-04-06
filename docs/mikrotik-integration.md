# Integracao MikroTik RouterOS v7

## Premissas

- LAN do Wi-Fi: `10.10.10.0/24`
- MikroTik LAN IP: `10.10.10.1`
- Servidor da stack: `10.10.10.10`
- Interface do Wi-Fi: `bridge-lan`
- Dominio publico do portal: `wifi.example.com`

## 1. Criar pool DHCP

```routeros
/ip pool add name=pool-hotspot ranges=10.10.10.100-10.10.10.250
/ip dhcp-server network add address=10.10.10.0/24 gateway=10.10.10.1 dns-server=10.10.10.1
/ip dhcp-server add name=dhcp-hotspot interface=bridge-lan address-pool=pool-hotspot lease-time=1h disabled=no
```

## 2. Ajustar DNS local

```routeros
/ip dns set allow-remote-requests=yes servers=1.1.1.1,8.8.8.8
```

## 3. Criar profile do HotSpot

Neste MVP, use `http-pap` para o fluxo basico de senha mantida no servidor.

```routeros
/ip hotspot profile add \
  name=hsprof-academia \
  hotspot-address=10.10.10.1 \
  dns-name=wifi.example.com \
  login-by=http-pap \
  radius-accounting=yes \
  radius-interim-update=5m \
  use-radius=yes
```

## 4. Ativar o HotSpot

```routeros
/ip hotspot add \
  name=hotspot-academia \
  interface=bridge-lan \
  profile=hsprof-academia \
  address-pool=pool-hotspot \
  disabled=no
```

## 5. Configurar o RADIUS

```routeros
/radius add \
  service=hotspot \
  address=10.10.10.10 \
  secret=change_me_radius_secret \
  authentication-port=1812 \
  accounting-port=1813 \
  src-address=10.10.10.1 \
  timeout=1100ms
```

## 6. Confirmar accounting e interim-update

```routeros
/ip hotspot profile set hsprof-academia use-radius=yes radius-accounting=yes radius-interim-update=5m
```

## 7. Liberar walled-garden para o portal

Se o portal estiver em dominio externo ao proprio MikroTik:

```routeros
/ip hotspot walled-garden add dst-host=wifi.example.com
```

## 8. Testes basicos

```routeros
/radius monitor 0
/log print where topics~"radius|hotspot"
/ip hotspot active print
```

## 9. Troubleshooting rapido

- se o `radius monitor` nao mostrar trafego, revise rota, firewall e `src-address`
- se houver rejeicao, confira usuario, senha, `clients.conf` e shared secret
- se autentica mas nao aplica banda, revise a view `radreply`
- se nao houver accounting, valide `radius-accounting=yes` e `Acct-Interim-Interval`

