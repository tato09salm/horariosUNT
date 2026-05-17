'use client';

const CICLOS_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2'];

export default function LeyendaHorarios({ ciclos = [1, 2, 3, 4, 5, 6] }: { ciclos?: number[] }) {
  return (
    <div className="leyenda-horarios card">
      <h4 className="leyenda-horarios__titulo">Leyenda</h4>
      <div className="leyenda-horarios__grid">
        <section>
          <p className="leyenda-horarios__seccion">Tipo de sesión</p>
          <ul>
            <li><span className="leyenda-dot leyenda-dot--teoria" /> Teoría</li>
            <li><span className="leyenda-dot leyenda-dot--lab" /> Laboratorio</li>
            <li><span className="leyenda-dot leyenda-dot--asesoria" /> Asesoría</li>
          </ul>
        </section>
        <section>
          <p className="leyenda-horarios__seccion">Prioridad</p>
          <ul>
            <li>P1 — Preferido</li>
            <li>P2 — Aceptable</li>
          </ul>
        </section>
        <section>
          <p className="leyenda-horarios__seccion">Bloques</p>
          <ul>
            <li>Continuo — mismas horas seguidas</li>
            <li>Divisible — labs en días distintos</li>
          </ul>
        </section>
        <section>
          <p className="leyenda-horarios__seccion">Ciclos</p>
          <ul className="leyenda-ciclos">
            {ciclos.map((c, i) => (
              <li key={c}>
                <span className="leyenda-ciclo-bar" style={{ background: CICLOS_COLORS[i % CICLOS_COLORS.length] }} />
                Ciclo {c}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
