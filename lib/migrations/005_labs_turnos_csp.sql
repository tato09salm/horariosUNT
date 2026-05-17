-- Laboratorio: horas_laboratorio = horas por turno/subgrupo; cantidad_labs = número de turnos.
-- Los labs no requieren bloque continuo (CSP asigna hora a hora).

UPDATE cursos
SET horas_laboratorio = horas_practica,
    bloque_indivisible = true
WHERE horas_laboratorio = 0 AND horas_practica > 0;

-- POO: 2h teoría (bloque continuo) + 3 turnos de lab de 4h cada uno
UPDATE cursos
SET horas_teoria = 2,
    horas_practica = 0,
    horas_laboratorio = 4,
    cantidad_labs = 3,
    bloque_indivisible = true
WHERE codigo = 'IS-201';

-- Diseño Web: 1h teoría + 2 turnos de lab de 3h
UPDATE cursos
SET horas_teoria = 1,
    horas_practica = 0,
    horas_laboratorio = 3,
    cantidad_labs = 2,
    bloque_indivisible = true
WHERE codigo = 'IS-401';

-- Física general (ciclo X): 2h teoría + 3 turnos de lab de 2h
UPDATE cursos
SET horas_teoria = 2,
    horas_practica = 0,
    horas_laboratorio = 2,
    cantidad_labs = 3,
    bloque_indivisible = true
WHERE codigo = 'FIS-1001';

-- Cursos con varios turnos de lab (sin dividir horas entre turnos)
UPDATE cursos
SET cantidad_labs = 2,
    bloque_indivisible = true
WHERE codigo IN ('IS-402', 'IS-403', 'IS-404', 'IS-1002', 'IS-1006')
  AND horas_laboratorio >= 2;

UPDATE cursos
SET cantidad_labs = 3,
    bloque_indivisible = true
WHERE codigo IN ('IS-603', 'IS-802', 'IS-1003')
  AND horas_laboratorio >= 2;
