# Plan de Testing — CSP con Prioridades y Asesoría

## Requisitos previos

```bash
# Migración de columna prioridad
psql -U postgres -d horariosUNT -f lib/migrations/002_disponibilidad_prioridad.sql

# O re-ejecutar seed completo (recrea triggers y disponibilidad)
psql -U postgres -d horariosUNT -f lib/schema-data-real.sql
```

Login: `admin@unt.edu.pe` / `password`

---

## Casos de prueba por docente (seed)

### CASO A — Conflicto de aula

| Docente | DNI | Restricción seed | Por qué |
|---------|-----|------------------|---------|
| **Luis Boy Chavil** | 28282828 | Solo mañanas (orden ≤ 6) | Principal con muchos cursos en ciclo V |
| **Robert Jerry Sánchez Ticona** | 29292929 | Solo tardes (orden > 6) | Compite por slots de tarde con otros |
| **Marcelino Torres Villanueva** | 11111111 | Bloques fragmentados (orden par) | Alta demanda de aulas en horarios discontinuos |

**Validar:** Mismo slot/aula no tiene dos grupos; si hay choque, CSP reubica o reporta conflicto.

### CASO B — Conflicto de docente (doble asignación)

| Docente | Cursos típicos |
|---------|----------------|
| **Zoraida Vidal Melgarejo** | IS-301, IS-302, MAT-301 (ciclo III, varias horas) |
| **Segundo Guibar Obeso** | Ciclo I con múltiples asignaturas |

**Validar:** En consola del servidor y grilla, ningún docente aparece en dos celdas del mismo día/slot.

### CASO C — Restricción de prioridad

| Docente | Categoría | Competidor |
|---------|-----------|------------|
| **Marcelino Torres Villanueva** | Principal, nombrado | **Paul Cotrina Castellanos** (auxiliar, contratado) |

Ambos pueden compartir ventanas de alta prioridad limitadas (≈20% de slots marcados P1).

**Validar:** Tras CSP, Torres tiene mayor `% preferida` que Cotrina. Revisar panel "Estadísticas CSP" en Fase 3.

### CASO D — Disponibilidad insuficiente

| Docente | Escenario |
|---------|-----------|
| **Martha Cardoso** | Auxiliar con disponibilidad muy reducida (tipo hash % 5) |
| Cualquier docente con **horas curso + 1 asesoría > slots disponibles** | Modal de advertencia antes de ejecutar CSP |

**Validar:** `POST /api/horarios/resolver` con `dry_run: true` devuelve `advertencias` antes de correr el motor.

---

## Protocolo de testing

### PASO 1 — Generación inicial

- [ ] Crear o abrir programación en Fase 3
- [ ] Ejecutar **Auto-Asignación**
- [ ] Verificar grillas por ciclo (I, III, V, VII, IX…)
- [ ] En **Vista por docente**, confirmar bloque **ASESORÍA** (fondo índigo) para cada docente activo
- [ ] Revisar consola del servidor: logs `[CSP]` con `PREFERIDA` / `ACEPTABLE`

### PASO 2 — Verificación de prioridades

- [ ] Filtrar docente **Marcelino Torres** → mayoría de bloques con `· P1`
- [ ] Filtrar **Paul Cotrina** → más bloques `· P2`
- [ ] Panel estadísticas: principales ≥ 80% preferida, asociados ≥ 60% (meta del proyecto)

### PASO 3 — Re-ejecución CSP

- [ ] Anotar hash/config de asignaciones
- [ ] Re-ejecutar sin cambiar datos → mismos resultados (idempotencia)
- [ ] *(Opcional)* Cambiar disponibilidad de un docente y re-ejecutar → solo afecta sus bloques

### PASO 4 — Validación de conflictos

- [ ] `conflictos_horario` vacío o con mensajes accionables
- [ ] Sin dos grupos en mismo aula/slot
- [ ] Sin docente en dos lugares simultáneos
- [ ] Asesoría no solapa con curso del mismo docente

---

## Métricas de éxito

| Métrica | Objetivo |
|---------|----------|
| Cursos asignados sin conflicto duro | 100% |
| Principales en horario preferido (P1) | ≥ 80% |
| Asociados en P1 | ≥ 60% |
| Asesoría por docente activo | 1 h c/u |
| Idempotencia CSP | Mismos inputs → mismos outputs |
| Tiempo ejecución (50+ cursos) | < 30 s |

---

## UI — Disponibilidad (Fase 2)

| Clic | Estado | Color |
|------|--------|-------|
| 1 | Alta prioridad (preferida) | Verde `#059669` |
| 2 | Baja prioridad (aceptable) | Amarillo `#fde047` |
| 3 | No disponible | Rojo claro `#fef2f2` |

---

## Logs de debug

Tras ejecutar CSP, revisar:

1. **Consola Node:** `[CSP] Estadísticas prioridad: { alta, baja, asesorias, ms }`
2. **`programaciones.config.csp_stats`:** JSON con `por_docente`, `log[]`
3. **UI Fase 3:** tarjeta "Estadísticas CSP"

Ejemplo de log por asignación:

```
[CSP] Torres Villanueva, Marcelino → IS-101 lunes slot#3 (PREFERIDA)
[CSP] Cotrina Castellanos, Paul → IS-103 martes slot#8 (ACEPTABLE)
```

---

## Resultados esperados (ejemplo)

- **Torres (principal):** 8 bloques → 7 P1, 1 P2 → 87% preferida ✓
- **Cotrina (auxiliar):** 5 bloques → 2 P1, 3 P2 → 40% preferida (aceptable por jerarquía)
- **Todos los docentes:** 1 celda `ASESORÍA` en horario libre del docente
