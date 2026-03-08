# WebDollar Explorer Next (Vue 3)

Frontend nou pentru explorer, construit cu Vue 3 + Vite + TypeScript.

## 1) Development local

### Instalare
```bash
npm install
```

### Pornire
```bash
npm run dev
```

Aplicația rulează implicit pe `http://localhost:5173`.

## 2) Proxy API în development

Frontend-ul folosește endpointuri `/api/*` și Vite face proxy către backend.

Implicit target-ul este:
`http://127.0.0.1:5555`

Dacă vrei alt target, setezi variabila:

Windows PowerShell:
```powershell
$env:VITE_API_PROXY_TARGET="http://127.0.0.1:5555"
npm run dev
```

Linux/macOS:
```bash
VITE_API_PROXY_TARGET=http://127.0.0.1:5555 npm run dev
```

## 3) Build producție

```bash
npm run build
```

Output-ul este în `dist/`.

## 4) Cum îl muți pe VPS (repo nou GitHub)

Repo: `https://github.com/daniuda/explorer-webdollar`

### Primul deploy pe VPS
```bash
cd /home/node
git clone https://github.com/daniuda/explorer-webdollar.git
cd explorer-webdollar
npm install
npm run build
```

### Publicare cu Nginx (static)

Copie build-ul într-un folder servit de Nginx:
```bash
sudo rm -rf /var/www/explorer-webdollar
sudo mkdir -p /var/www/explorer-webdollar
sudo cp -r dist/* /var/www/explorer-webdollar/
```

Exemplu config Nginx (frontend + proxy API):
```nginx
server {
	listen 80;
	server_name _;

	root /var/www/explorer-webdollar;
	index index.html;

	location / {
		try_files $uri $uri/ /index.html;
	}

	location /api/ {
		proxy_pass http://127.0.0.1:5555/;
		proxy_http_version 1.1;
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
	}
}
```

Aplicare:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 5) Update pe VPS după modificări noi

```bash
cd /home/node/explorer-webdollar
git pull origin main
npm install
npm run build
sudo cp -r dist/* /var/www/explorer-webdollar/
sudo systemctl reload nginx
```
