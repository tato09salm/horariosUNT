$output = "lib\migrations\013_seeder_carga_horaria_2026I.sql"

# CSV rows: (plan, codigo, grupo, dni, T, P, L)
$rows = [System.Collections.ArrayList]@()

function Add-Row($p, $c, $g, $d, $t, $p2, $l) {
  $null = $rows.Add(@{plan=$p; codigo=$c; grupo=$g; dni=$d; T=$t; P=$p2; L=$l})
}

# === Ciclo I ===
Add-Row 1 'EE-101' 'G1 (Teoria)'       '22222222' 1 0 0
Add-Row 1 'EE-101' 'G1 (Practica)'     '22222222' 0 2 0
Add-Row 1 'EE-102' 'G1 (Teoria)'       '11111111' 2 0 0
Add-Row 1 'EE-102' 'G3 (Laboratorio)'  '11111111' 0 0 4
Add-Row 1 'EE-102' 'G2 (Laboratorio)'  '33333333' 0 0 4
Add-Row 1 'EE-102' 'G1 (Laboratorio)'  '33333333' 0 0 4
Add-Row 1 'EE-102' 'G4 (Laboratorio)'  '11111111' 0 0 4
Add-Row 1 'EG-101' 'G1 (Teoria)'       '55555555' 1 0 0
Add-Row 1 'EG-101' 'G1 (Practica)'     '55555555' 0 4 0
Add-Row 1 'EG-102' 'G1 (Teoria)'       '66666666' 2 0 0
Add-Row 1 'EG-102' 'G1 (Practica)'     '66666666' 0 2 0
Add-Row 1 'EG-103' 'G1 (Teoria)'       '44444444' 2 0 0
Add-Row 1 'EG-103' 'G1 (Practica)'     '44444444' 0 2 0
Add-Row 1 'EG-104' 'G1 (Teoria)'       '77777777' 2 0 0
Add-Row 1 'EG-104' 'G1 (Practica)'     '77777777' 0 4 0
Add-Row 1 'EG-105' 'G1 (Teoria)'       '99999999' 2 0 0
Add-Row 1 'EG-105' 'G2 (Teoria)'       '88888888' 2 0 0
Add-Row 1 'EG-105' 'G2 (Practica)'     '88888888' 0 2 0
Add-Row 1 'EG-105' 'G1 (Practica)'     '99999999' 0 2 0
Add-Row 1 'EL-101' 'G1 (Practica)'     '70707070' 0 2 0
Add-Row 1 'EL-102' 'G1 (Practica)'     '70808080' 0 2 0
Add-Row 1 'EL-103' 'G1 (Practica)'     '70909090' 0 2 0

# === Ciclo III ===
Add-Row 3 'EE-301' 'G3 (Teoria)'       '21212121' 1 0 0
Add-Row 3 'EE-301' 'G1 (Practica)'     '21212121' 0 2 0
Add-Row 3 'EE-301' 'G3 (Laboratorio)'  '21212121' 0 0 6
Add-Row 3 'EE-301' 'G1 (Laboratorio)'  '21212121' 0 0 6
Add-Row 3 'EE-301' 'G2 (Laboratorio)'  '21212121' 0 0 6
Add-Row 3 'EE-302' 'G3 (Teoria)'       '20202020' 2 0 0
Add-Row 3 'EE-302' 'G1 (Laboratorio)'  '20202020' 0 0 12
Add-Row 3 'EE-302' 'G2 (Laboratorio)'  '20202020' 0 0 12
Add-Row 3 'EE-302' 'G3 (Laboratorio)'  '20202020' 0 0 12
Add-Row 3 'EL-301' 'G3 (Teoria)'       '22222223' 1 0 0
Add-Row 3 'EL-301' 'G1 (Practica)'     '22222223' 0 1 0
Add-Row 3 'EL-301' 'G2 (Laboratorio)'  '22222223' 0 0 6
Add-Row 3 'EL-301' 'G1 (Laboratorio)'  '22222223' 0 0 6
Add-Row 3 'EL-302' 'G3 (Teoria)'       '27272727' 2 0 0
Add-Row 3 'EL-302' 'G1 (Practica)'     '27272727' 0 2 0
Add-Row 3 'EP-301' 'G3 (Teoria)'       '25252525' 2 0 0
Add-Row 3 'EP-301' 'G1 (Practica)'     '25252525' 0 2 0
Add-Row 3 'EP-302' 'G3 (Teoria)'       '24242424' 1 0 0
Add-Row 3 'EP-302' 'G1 (Practica)'     '24242424' 0 2 0
Add-Row 3 'EP-302' 'G3 (Laboratorio)'  '24242424' 0 0 6
Add-Row 3 'EP-302' 'G1 (Laboratorio)'  '24242424' 0 0 6
Add-Row 3 'EP-302' 'G2 (Laboratorio)'  '24242424' 0 0 6
Add-Row 3 'EP-303' 'G3 (Teoria)'       '23232323' 1 0 0
Add-Row 3 'EP-303' 'G1 (Practica)'     '23232323' 0 2 0
Add-Row 3 'EP-303' 'G1 (Laboratorio)'  '23232323' 0 0 2
Add-Row 3 'EP-304' 'G3 (Teoria)'       '26262626' 1 0 0
Add-Row 3 'EP-304' 'G1 (Practica)'     '26262626' 0 4 0
Add-Row 3 'EP-304' 'G4 (Laboratorio)'  '26262626' 0 0 8
Add-Row 3 'EP-304' 'G3 (Laboratorio)'  '26262626' 0 0 8
Add-Row 3 'EP-304' 'G1 (Laboratorio)'  '26262626' 0 0 8
Add-Row 3 'EP-304' 'G2 (Laboratorio)'  '26262626' 0 0 8

# === Ciclo V ===
Add-Row 5 'EE-501' 'G5 (Teoria)'       '29292929' 1 0 0
Add-Row 5 'EE-501' 'G1 (Practica)'     '29292929' 0 1 0
Add-Row 5 'EE-501' 'G2 (Laboratorio)'  '29292929' 0 0 9
Add-Row 5 'EE-501' 'G3 (Laboratorio)'  '29292929' 0 0 9
Add-Row 5 'EE-501' 'G1 (Laboratorio)'  '29292929' 0 0 9
Add-Row 5 'EE-502' 'G5 (Teoria)'       '28282828' 2 0 0
Add-Row 5 'EE-502' 'G1 (Practica)'     '28282828' 0 1 0
Add-Row 5 'EE-502' 'G3 (Laboratorio)'  '28282828' 0 0 9
Add-Row 5 'EE-502' 'G1 (Laboratorio)'  '28282828' 0 0 9
Add-Row 5 'EE-502' 'G2 (Laboratorio)'  '28282828' 0 0 9
Add-Row 5 'EE-503' 'G5 (Teoria)'       '30303030' 1 0 0
Add-Row 5 'EE-503' 'G1 (Practica)'     '30303030' 0 2 0
Add-Row 5 'EE-503' 'G1 (Laboratorio)'  '30303030' 0 0 6
Add-Row 5 'EE-503' 'G2 (Laboratorio)'  '30303030' 0 0 6
Add-Row 5 'EE-503' 'G3 (Laboratorio)'  '30303030' 0 0 6
Add-Row 5 'EE-504' 'G5 (Teoria)'       '22222223' 2 0 0
Add-Row 5 'EE-504' 'G1 (Practica)'     '22222223' 0 2 0
Add-Row 5 'EE-504' 'G3 (Laboratorio)'  '22222223' 0 0 6
Add-Row 5 'EE-504' 'G1 (Laboratorio)'  '22222223' 0 0 6
Add-Row 5 'EE-504' 'G2 (Laboratorio)'  '22222223' 0 0 6
Add-Row 5 'EL-501' 'G5 (Teoria)'       '31313131' 1 0 0
Add-Row 5 'EL-501' 'G1 (Practica)'     '31313131' 0 2 0
Add-Row 5 'EL-501' 'G2 (Laboratorio)'  '31313131' 0 0 4
Add-Row 5 'EL-501' 'G1 (Laboratorio)'  '31313131' 0 0 4
Add-Row 5 'EL-502' 'G5 (Teoria)'       '21212121' 2 0 0
Add-Row 5 'EL-502' 'G1 (Laboratorio)'  '21212121' 0 0 4
Add-Row 5 'EL-502' 'G2 (Laboratorio)'  '21212121' 0 0 4
Add-Row 5 'EP-501' 'G5 (Teoria)'       '33333334' 1 0 0
Add-Row 5 'EP-501' 'G1 (Practica)'     '33333334' 0 2 0
Add-Row 5 'EP-501' 'G1 (Laboratorio)'  '33333334' 0 0 2
Add-Row 5 'EP-502' 'G5 (Teoria)'       '32323232' 1 0 0
Add-Row 5 'EP-502' 'G1 (Practica)'     '32323232' 0 2 0
Add-Row 5 'EP-502' 'G2 (Laboratorio)'  '32323232' 0 0 6
Add-Row 5 'EP-502' 'G3 (Laboratorio)'  '32323232' 0 0 6
Add-Row 5 'EP-502' 'G1 (Laboratorio)'  '32323232' 0 0 6

# === Ciclo VII ===
Add-Row 7 'EE-701' 'G7 (Teoria)'       '22222222' 1 0 0
Add-Row 7 'EE-701' 'G1 (Practica)'     '22222222' 0 2 0
Add-Row 7 'EE-701' 'G1 (Laboratorio)'  '22222222' 0 0 4
Add-Row 7 'EE-701' 'G2 (Laboratorio)'  '22222222' 0 0 4
Add-Row 7 'EE-702' 'G7 (Teoria)'       '36363636' 1 0 0
Add-Row 7 'EE-702' 'G1 (Practica)'     '36363636' 0 2 0
Add-Row 7 'EE-702' 'G4 (Laboratorio)'  '36363636' 0 0 8
Add-Row 7 'EE-702' 'G2 (Laboratorio)'  '36363636' 0 0 8
Add-Row 7 'EE-702' 'G1 (Laboratorio)'  '36363636' 0 0 8
Add-Row 7 'EE-702' 'G3 (Laboratorio)'  '36363636' 0 0 8
Add-Row 7 'EE-703' 'G7 (Teoria)'       '30303030' 1 0 0
Add-Row 7 'EE-703' 'G1 (Practica)'     '30303030' 0 1 0
Add-Row 7 'EE-703' 'G2 (Laboratorio)'  '30303030' 0 0 9
Add-Row 7 'EE-703' 'G3 (Laboratorio)'  '30303030' 0 0 9
Add-Row 7 'EE-703' 'G1 (Laboratorio)'  '30303030' 0 0 9
Add-Row 7 'EE-704' 'G7 (Teoria)'       '29292929' 2 0 0
Add-Row 7 'EE-704' 'G8 (Teoria)'       '34343434' 2 0 0
Add-Row 7 'EE-704' 'G2 (Practica)'     '34343434' 0 1 0
Add-Row 7 'EE-704' 'G1 (Practica)'     '29292929' 0 1 0
Add-Row 7 'EE-704' 'G3 (Laboratorio)'  '34343434' 0 0 3
Add-Row 7 'EE-704' 'G2 (Laboratorio)'  '29292929' 0 0 6
Add-Row 7 'EE-704' 'G1 (Laboratorio)'  '29292929' 0 0 6
Add-Row 7 'EI-701' 'G7 (Teoria)'       '33333333' 2 0 0
Add-Row 7 'EI-701' 'G1 (Practica)'     '33333333' 0 2 0
Add-Row 7 'EL-701' 'G7 (Teoria)'       '35353535' 1 0 0
Add-Row 7 'EL-701' 'G1 (Practica)'     '35353535' 0 1 0
Add-Row 7 'EL-701' 'G1 (Laboratorio)'  '35353535' 0 0 6
Add-Row 7 'EL-701' 'G2 (Laboratorio)'  '35353535' 0 0 6
Add-Row 7 'EL-702' 'G8 (Teoria)'       '21212121' 2 0 0
Add-Row 7 'EL-702' 'G7 (Teoria)'       '33333333' 2 0 0
Add-Row 7 'EL-702' 'G2 (Laboratorio)'  '33333333' 0 0 4
Add-Row 7 'EL-702' 'G3 (Laboratorio)'  '21212121' 0 0 2
Add-Row 7 'EL-702' 'G1 (Laboratorio)'  '33333333' 0 0 4
Add-Row 7 'EP-701' 'G7 (Teoria)'       '37373737' 2 0 0
Add-Row 7 'EP-701' 'G1 (Practica)'     '37373737' 0 2 0

# === Ciclo IX ===
Add-Row 9 'EE-901' 'G9 (Teoria)'       '38383838' 1 0 0
Add-Row 9 'EE-901' 'G1 (Practica)'     '38383838' 0 2 0
Add-Row 9 'EE-901' 'G2 (Laboratorio)'  '38383838' 0 0 6
Add-Row 9 'EE-901' 'G1 (Laboratorio)'  '38383838' 0 0 6
Add-Row 9 'EE-901' 'G3 (Laboratorio)'  '38383838' 0 0 6
Add-Row 9 'EE-902' 'G9 (Teoria)'       '22222222' 1 0 0
Add-Row 9 'EE-902' 'G1 (Practica)'     '22222222' 0 2 0
Add-Row 9 'EE-902' 'G1 (Laboratorio)'  '22222222' 0 0 4
Add-Row 9 'EE-902' 'G2 (Laboratorio)'  '22222222' 0 0 4
Add-Row 9 'EE-903' 'G9 (Teoria)'       '35353535' 1 0 0
Add-Row 9 'EE-903' 'G1 (Practica)'     '35353535' 0 2 0
Add-Row 9 'EE-903' 'G1 (Laboratorio)'  '35353535' 0 0 2
Add-Row 9 'EE-904' 'G9 (Teoria)'       '38383838' 1 0 0
Add-Row 9 'EE-904' 'G1 (Practica)'     '38383838' 0 1 0
Add-Row 9 'EE-904' 'G3 (Laboratorio)'  '38383838' 0 0 9
Add-Row 9 'EE-904' 'G1 (Laboratorio)'  '38383838' 0 0 9
Add-Row 9 'EE-904' 'G2 (Laboratorio)'  '38383838' 0 0 9
Add-Row 9 'EE-905' 'G9 (Teoria)'       '11111111' 1 0 0
Add-Row 9 'EE-905' 'G1 (Practica)'     '11111111' 0 1 0
Add-Row 9 'EE-905' 'G1 (Laboratorio)'  '11111111' 0 0 9
Add-Row 9 'EE-905' 'G2 (Laboratorio)'  '11111111' 0 0 9
Add-Row 9 'EE-905' 'G3 (Laboratorio)'  '11111111' 0 0 9
Add-Row 9 'EI-901' 'G9 (Teoria)'       '35353535' 2 0 0
Add-Row 9 'EI-901' 'G10 (Teoria)'      '34343434' 2 0 0
Add-Row 9 'EI-901' 'G2 (Practica)'     '34343434' 0 2 0
Add-Row 9 'EI-901' 'G1 (Practica)'     '35353535' 0 2 0
Add-Row 9 'EI-901' 'G2 (Laboratorio)'  '34343434' 0 0 2
Add-Row 9 'EI-901' 'G1 (Laboratorio)'  '35353535' 0 0 2
Add-Row 9 'EL-901' 'G9 (Teoria)'       '36363636' 2 0 0
Add-Row 9 'EL-901' 'G2 (Laboratorio)'  '36363636' 0 0 4
Add-Row 9 'EL-901' 'G1 (Laboratorio)'  '36363636' 0 0 4
Add-Row 9 'EL-902' 'G9 (Teoria)'       '31313131' 2 0 0
Add-Row 9 'EL-902' 'G1 (Laboratorio)'  '31313131' 0 0 4
Add-Row 9 'EL-902' 'G2 (Laboratorio)'  '31313131' 0 0 4

# --- Build unique docentes list (ordered) ---
$docentes = @{}  # dni -> name
$docentesOrder = [System.Collections.ArrayList]@()
$docNum = 1
foreach ($r in $rows) {
  if (-not $docentes.ContainsKey($r.dni)) {
    $docentes[$r.dni] = "Docente$docNum"
    $null = $docentesOrder.Add($r.dni)
    $docNum++
  }
}

# --- Aggregate (dni, codigo) -> hours + group counts ---
$cursoAgg = @{}
foreach ($r in $rows) {
  $key = "$($r.dni)|$($r.codigo)"
  if (-not $cursoAgg.ContainsKey($key)) {
    $cursoAgg[$key] = @{
      dni=$r.dni; codigo=$r.codigo; plan=$r.plan
      T=0; P=0; L=0
      tGrp=@{}; pGrp=@{}; lGrp=@{}
    }
  }
  $a = $cursoAgg[$key]; if ($r.T -gt $a.T) { $a.T = $r.T }; if ($r.P -gt $a.P) { $a.P = $r.P }; if ($r.L -gt $a.L) { $a.L = $r.L }
  $m = [regex]::Match($r.grupo, 'G(\d+) \((.+)\)')
  if ($m.Success) {
    $gn = [int]$m.Groups[1].Value; $tp = $m.Groups[2].Value
    switch ($tp) { 'Teoria' { $a.tGrp[$gn]=$true }; 'Practica' { $a.pGrp[$gn]=$true }; 'Laboratorio' { $a.lGrp[$gn]=$true } }
  }
}

# --- Generate SQL ---
$sb = [System.Text.StringBuilder]::new()
$nl = [Environment]::NewLine
$DQ = [char]36 + [char]36
$N = [char]241

function L($s) { $null = $sb.Append($s + $nl) }

L "-- Seeder 2026-I para Carga Horaria"
L "-- ===================================="
L ""
L "DO $DQ"
L "DECLARE"
L "  v_ciclo_id UUID;"
L "  v_curso_id UUID;"
L "  v_ch_id UUID;"
L "BEGIN"
L ""
L "  -- Asegurar ciclo 2026-I"
L "  INSERT INTO ciclos (nombre, a${N}o, semestre, activo)"
L "  SELECT '2026-I', 2026, 1, true"
L "  WHERE NOT EXISTS (SELECT 1 FROM ciclos WHERE nombre = '2026-I');"
L ""
L "  SELECT id INTO v_ciclo_id FROM ciclos WHERE nombre = '2026-I';"
L ""

# Docentes INSERT
foreach ($dni in $docentesOrder) {
  $name = $docentes[$dni]
  L "  -- Docente DNI $dni"
  L "  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)"
  L "  SELECT '$dni', '$name', 'Apellidos', 'docente${dni}@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true"
  L "  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '$dni');"
  L ""
}

# Carga Horaria + Cursos (interleaved per docente)
$roman = @{1='I';3='III';5='V';7='VII';9='IX'}
$planSeen = @{}

foreach ($dni in $docentesOrder) {
  $name = $docentes[$dni]
  # Find all plans this docente appears in
  $plans = @{}
  foreach ($key in $cursoAgg.Keys) {
    $a = $cursoAgg[$key]
    if ($a.dni -eq $dni) { $plans[$a.plan] = $true }
  }
  $planList = @($plans.Keys | Sort-Object)
  $minPlan = $planList[0]
  $planStr = ($planList | ForEach-Object { $roman[$_] }) -join ', '

  # Carga Horaria INSERT
  L "  -- Carga Horaria: $name (DNI $dni) - Ciclos $planStr"
  L "  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)"
  L "  SELECT d.id, v_ciclo_id, $minPlan, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true"
  L "  FROM docentes d WHERE d.dni = '$dni'"
  L "  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;"
  L ""
  L "  SELECT ch.id INTO v_ch_id FROM carga_horaria ch"
  L "  JOIN docentes d ON ch.docente_id = d.id"
  L "  WHERE d.dni = '$dni' AND ch.ciclo_academico_id = v_ciclo_id;"
  L ""

  # Cursos for this docente
  foreach ($key in $cursoAgg.Keys) {
    $a = $cursoAgg[$key]
    if ($a.dni -ne $dni) { continue }
    $tG = $a.tGrp.Count; $pG = $a.pGrp.Count; $lG = $a.lGrp.Count
    $total = ($a.T * $tG) + ($a.P * $pG) + ($a.L * $lG)
    $sec = "$($a.plan)-A"

    L "  -- $($a.codigo) (Ciclo $($roman[$a.plan]))"
    L "  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = '$($a.codigo)';"
    L "  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)"
    L "  SELECT v_ch_id, v_curso_id, '$sec', 'Ing. Sistemas', 40, $($a.T), $($a.P), $($a.L), $total, $tG, $pG, $lG"
    L "  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);"
    L ""
  }

  # Update horas_asignadas
  L "  UPDATE carga_horaria SET horas_asignadas = ("
  L "    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)"
  L "    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id"
  L "  ) WHERE id = v_ch_id;"
  L ""
}

L "END;"
L "$DQ;"

Set-Content -Path $output -Value $sb.ToString() -Encoding UTF8
Write-Output "Done: $(@($docentesOrder).Count) docentes, $($cursoAgg.Count) cursos"
