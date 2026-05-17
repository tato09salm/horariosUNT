# SiHorarios UNT — Sistema de Horarios Académicos
# Escuela de Ingeniería de Sistemas — Universidad Nacional de Trujillo

## INSTALACIÓN RÁPIDA

### 1. Instalar y ejecutar
npm install

### 2. Crear, migrar y poblar base de datos PostgreSQL
npx sequelize-cli db:create
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all

### 3. Iniciar servidor
npm run dev   →   http://localhost:3000

## CREDENCIALES
Admin:      admin@unt.edu.pe      / password
Secretaria: secretaria@unt.edu.pe / password

## VARIABLES DE ENTORNO (.env.local)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=horariosUNT
DB_USER=postgres
DB_PASSWORD=sa
JWT_SECRET=jwt-horarios-unt-2024

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
