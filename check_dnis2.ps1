$env:PGPASSWORD = "12345"
$env:PGCLIENTENCODING = "UTF8"
$output = psql -U postgres -h localhost -p 5432 -d horariosUNT -c "SELECT dni, nombre, apellidos FROM docentes WHERE dni IN ('22222223', '48484848', '49494949', '50505050') ORDER BY dni;" -t
Write-Host $output
