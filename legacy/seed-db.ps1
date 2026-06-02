# seed-db.ps1
# Aplica migraciones y regenera disponibilidad restrictiva (P1/P2)
# Uso: npm run db:seed

chcp 65001 | Out-Null
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:PGCLIENTENCODING = "UTF8"

$envFile = ".env.local"
if (-not (Test-Path $envFile)) { $envFile = ".env" }
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

Write-Host "Conectando a $name_db..." -ForegroundColor Cyan

Write-Host "`n[1/10] Migraciones (002-010)..." -ForegroundColor Yellow
psql -U $user_db -h $host_db -p $port_db -d $name_db --set=client_encoding=UTF8 -f lib/migrations/002_disponibilidad_prioridad.sql
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
psql -U $user_db -h $host_db -p $port_db -d $name_db --set=client_encoding=UTF8 -f lib/migrations/003_cursos_bloques_docentes.sql
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
psql -U $user_db -h $host_db -p $port_db -d $name_db --set=client_encoding=UTF8 -f lib/migrations/004_disponibilidad_ambiente_csp.sql
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
psql -U $user_db -h $host_db -p $port_db -d $name_db --set=client_encoding=UTF8 -f lib/migrations/005_labs_turnos_csp.sql
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
psql -U $user_db -h $host_db -p $port_db -d $name_db --set=client_encoding=UTF8 -f lib/migrations/006_carga_curricular_2025ii.sql
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
psql -U $user_db -h $host_db -p $port_db -d $name_db --set=client_encoding=UTF8 -f lib/migrations/007_flex_conflictivos_csp.sql
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
psql -U $user_db -h $host_db -p $port_db -d $name_db --set=client_encoding=UTF8 -f lib/migrations/008_flex_paralelismo_csp.sql
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
psql -U $user_db -h $host_db -p $port_db -d $name_db --set=client_encoding=UTF8 -f lib/migrations/009_carga_curricular_2026i_ciclov_labs.sql
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
psql -U $user_db -h $host_db -p $port_db -d $name_db --set=client_encoding=UTF8 -f lib/migrations/010-fix-programacion-cursos-uk.sql
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n[2/3] Regenerando disponibilidad (008 ya aplicó poblar)..." -ForegroundColor Yellow
psql -U $user_db -h $host_db -p $port_db -d $name_db --set=client_encoding=UTF8 -f lib/seed-disponibilidad.sql
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n[3/3] Verificacion rapida..." -ForegroundColor Yellow
psql -U $user_db -h $host_db -p $port_db -d $name_db -c @"
SELECT
  p.nombre AS programacion,
  COUNT(dd.id) AS celdas_disponibles,
  COUNT(dd.id) FILTER (WHERE dd.prioridad = 1) AS alta_p1,
  COUNT(dd.id) FILTER (WHERE dd.prioridad = 2) AS baja_p2
FROM programaciones p
LEFT JOIN disponibilidad_docente dd ON dd.programacion_id = p.id
GROUP BY p.id, p.nombre
ORDER BY p.nombre;
"@

Write-Host "`nListo. En Fase 2 veras verde (P1), amarillo (P2) y rojo (no disponible)." -ForegroundColor Green
Write-Host "Si la cobertura sigue en 100%%, ejecuta npm run db:reset para recrear la BD completa." -ForegroundColor DarkGray
