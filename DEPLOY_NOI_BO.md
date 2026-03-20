# Trien khai app chi dung noi bo (LAN)

Tai lieu nay dung cho may Windows chay app va cho nhieu may trong cung wifi/LAN truy cap.

## 1) Cai va chay app

Mo PowerShell tai thu muc app, chay:

```powershell
npm install
$env:HOST="0.0.0.0"
$env:PORT="3000"
$env:INTERNAL_ONLY="true"
npm start
```

Giai thich:
- HOST=0.0.0.0: cho phep may khac trong LAN truy cap
- INTERNAL_ONLY=true: server tu chan IP ngoai noi bo (chi cho private IP)

## 2) Lay IP LAN cua may chay app

Chay lenh:

```powershell
ipconfig
```

Tim dong `IPv4 Address`, vi du `192.168.1.20`.

Nguoi trong nhom truy cap bang trinh duyet:

```text
http://192.168.1.20:3000
```

## 3) Mo firewall chi cho phep LAN

Chay PowerShell voi quyen Administrator:

```powershell
New-NetFirewallRule -DisplayName "AoHoiThao-App-3000" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -Profile Private -RemoteAddress LocalSubnet
```

Lenh nay chi mo cong 3000 cho thiet bi trong cung subnet noi bo.

## 4) Dam bao KHONG public ra Internet

- Khong cau hinh port forwarding tren modem/router cho cong 3000.
- Khong mo profile `Public` trong firewall rule.
- Neu mang cong cong, chi dung qua VPN noi bo.

## 5) Chay tu dong khi khoi dong may (tuy chon)

Ban co 2 cach don gian:
- Dung Task Scheduler de chay `npm start` khi dang nhap.
- Hoac dung PM2 (neu quen Node.js) de tu khoi dong lai khi app loi.

## 6) Kiem tra nhanh

Tu may chu:
- `http://localhost:3000` phai vao duoc

Tu may khac trong LAN:
- `http://<IP-LAN-MAY-CHU>:3000` phai vao duoc

Tu mang ngoai (4G):
- khong truy cap duoc neu cau hinh dung
