# CSP — Seed de datos y diagnóstico

## Cambios en el seed (`schema-data-real.sql`)

### Disponibilidad docente (bloques contiguos)

| Perfil | % docentes | Patrón |
|--------|------------|--------|
| Muy flexible | 30% (DNI %10 → 0-2) | Lun–Vie mañana 6h P1 + tardes Mar/Jue/Vie + sáb mañana |
| Flexible | 40% (3-6) | 4 días con bloque 5h + mié tarde |
| Moderada | 20% (7-8) | 3 días con bloques 4h |
| Restringida | 10% (9) | Fragmentado (casos de prueba CSP) |

**Refuerzo automático:** docentes con carga en la programación reciben horas extra si `disponibles < requeridas + asesoría`.

### Disponibilidad de ambientes (`disponibilidad_ambiente`)

- **Aulas:** Lun–Sáb 07:00–21:00; ~8% tienen 2h de mantenimiento/semana.
- **Laboratorios:** Lun–Vie completo; Sáb solo mañana; Sáb tarde = mantenimiento.
- **Auditorios:** no se poblan (no se usan en asignación automática regular).

### Programación demo

- `horas_laboratorio` copiadas del catálogo de cursos.
- `horas_consejeria = 1` por fila.
- `num_alumnos` mínimo 35 en grupos del demo.

## Comandos

```bash
npm run db:reset   # Recrea BD + seed completo (recomendado)
npm run db:seed    # Migraciones 002-004 + regenera disponibilidad
```

## Pre-validación (antes de ejecutar CSP)

```http
GET /api/horarios/resolver/pre-validacion?programacion_id={uuid}
```

Vista SQL: `v_pre_validacion_csp` — estados:

- `ok` — listo
- `horas_insuficientes` — pocas horas marcadas vs carga
- `sin_bloque_continuo` — no hay ventana continua para el bloque más largo del docente
- `pocos_dias` — menos de 3 días

El `dry_run` del resolver (`POST` con `dry_run: true`) incluye `pre_validacion` en la respuesta.

## Diagnóstico en fallos CSP

Cada conflicto guarda en `conflictos_horario`:

- `descripcion` — texto corto
- `datos` — JSON con análisis (horas, bloque máximo, aulas compatibles)
- `sugerencia` — acciones recomendadas

Logs en `config.csp_stats.log` del motor.

## Criterios de éxito esperados tras `db:reset`

- ≥85% docentes con bloque continuo de 4h+ (NOTICE al final del seed)
- Mayoría de filas en `v_pre_validacion_csp` con `estado = ok`
- CSP con muchos menos mensajes `No hay bloque continuo de Nh`

## Casos de prueba

1. Docente perfil 9 (DNI que termina en patrón restringido): puede seguir fallando bloques 4h — esperado.
2. Reejecutar CSP tras ampliar P1 en Fase 2 para un docente con alerta `sin_bloque_continuo`.
3. Lab en sábado tarde: debe evitar slots en mantenimiento (`disponibilidad_ambiente`).
