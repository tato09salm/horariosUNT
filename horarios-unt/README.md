# SiHorarios UNT — Sistema de Horarios Académicos
# Escuela de Ingeniería de Sistemas — Universidad Nacional de Trujillo

## INSTALACIÓN RÁPIDA

### 1. Crear base de datos PostgreSQL
psql -U postgres -c 'CREATE DATABASE "horariosUNT";'
psql -U postgres -d horariosUNT -f lib/schema.sql

### 2. Instalar y ejecutar
npm install
npm run dev   →   http://localhost:3000

## CREDENCIALES
Admin:      admin@unt.edu.pe      / password
Secretaria: secretaria@unt.edu.pe / password

## VARIABLES DE ENTORNO (.env.local)
Copy these to a local `.env.local` file and fill with your own secrets. Do NOT commit secrets.
DB_HOST=localhost
DB_PORT=5432
DB_NAME=horariosUNT
DB_USER=postgres
DB_PASSWORD=your_db_password_here
JWT_SECRET=change_this_to_a_random_secret

## MÓDULOS
1. Dashboard     - KPIs + gráficos dinámicos (Recharts)
2. Horarios      - Cuadrícula + asignación manual/automática
3. Docentes      - CRUD ordenado por jerarquía
4. Cursos        - Plan de estudios por ciclo
5. Aulas/Labs    - Gestión de ambientes
6. Reportes      - PDF operacional, por docente, gestión
7. Usuarios      - Roles: admin, secretaria, docente
8. Auditoría     - Log completo de acciones (solo admin)

## MOTOR DE ASIGNACIÓN (jerarquía)
Nombrados: Principal > Asociado > Auxiliar > Jefe de Práctica
Contratados: mismo orden
Dentro de cada nivel: por antigüedad (fecha_ingreso ASC)
