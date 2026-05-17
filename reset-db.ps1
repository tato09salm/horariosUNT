# reset-db.ps1
# Lee las variables del .env y ejecuta el schema completo
# Uso: npm run db:reset   o   .\reset-db.ps1

# Forzar encoding UTF-8 en la consola de Windows
chcp 65001 | Out-Null
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8
$env:PGCLIENTENCODING = "UTF8"

$envFile = ".env"
$config = @{}

Get-Content $envFile -Encoding UTF8 | ForEach-Object {
    if ($_ -match "^\s*([^#][^=]+)=(.+)$") {
        $config[$matches[1].Trim()] = $matches[2].Trim()
    }
}

$env:PGPASSWORD = $config["DB_PASSWORD"]
$host_db  = $config["DB_HOST"]
$port_db  = $config["DB_PORT"]
$name_db  = $config["DB_NAME"]
$user_db  = $config["DB_USER"]

Write-Host "Conectando a $name_db en $host_db`:$port_db como $user_db..." -ForegroundColor Cyan

Write-Host "`n[1/2] Limpiando base de datos..." -ForegroundColor Yellow
psql -U $user_db -h $host_db -p $port_db -d $name_db -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

Write-Host "`n[2/2] Cargando schema y datos reales..." -ForegroundColor Yellow
psql -U $user_db -h $host_db -p $port_db -d $name_db --set=client_encoding=UTF8 -f lib/schema-data-real.sql

Write-Host "`nBase de datos lista." -ForegroundColor Green

