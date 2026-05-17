$env:PGPASSWORD = "12345"
psql -U postgres -h localhost -p 5432 -d horariosUNT -f check_dnis.sql
