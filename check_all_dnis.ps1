$env:PGPASSWORD = "12345"
$env:PGCLIENTENCODING = "UTF8"
$output = psql -U postgres -h localhost -p 5432 -d horariosUNT -f check_all_dnis.sql -t
Write-Host $output
