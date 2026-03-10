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
# nu mai rula npm install / npm run build pe VPS
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

## 5) Deploy automat din GitHub Actions (recomandat)

Workflow creat in repo: `.github/workflows/deploy-vps.yml`

La fiecare `git push` pe `main`, GitHub Actions va face:
1. `npm ci`
2. `npm run build`
3. upload `dist` pe VPS
4. publicare in `/var/www/explorer-webdollar`
5. `nginx -t` si reload

### Secrets necesare in GitHub

In GitHub repo -> `Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`:

- `VPS_HOST` = IP sau host VPS
- `VPS_USER` = user SSH
- `VPS_SSH_KEY` = cheia privata SSH (tot continutul)
- `VPS_PORT` = port SSH (optional, implicit 22)

Important:
- Userul SSH trebuie sa poata rula `sudo` pentru comenzile din workflow.
- Aceasta varianta evita build-ul pe VPS, util cand nu poti face upgrade de Node.

## 6) Update manual (fallback)

```bash
cd /home/node
# copie dist din local pe VPS (ex: scp)
# apoi publica fiserele:
sudo cp -r /cale/catre/dist/* /var/www/explorer-webdollar/
sudo systemctl reload nginx
```
