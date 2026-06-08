export const CARRERA_CURRICULA_FIJA = 'INGENIERÍA DE SISTEMAS' as const;

export const MODALIDADES_CURRICULA = [
  'PRESENCIAL',
  'SEMIPRESENCIAL',
  'VIRTUAL',
  'MULTIPLE',
] as const;

export type ModalidadCurricula = (typeof MODALIDADES_CURRICULA)[number];

export const ESTADOS_CURRICULA = [
  'ACTIVA',
  'EN_EXTINCION',
  'TERMINADA',
  'BORRADOR',
  'INACTIVO',
] as const;

export type EstadoCurricula = (typeof ESTADOS_CURRICULA)[number] | 'ELIMINADA';

export const CURRICULA_ESTADO_LABELS: Record<EstadoCurricula, string> = {
  ACTIVA: 'Activa',
  EN_EXTINCION: 'En Extinción',
  TERMINADA: 'Terminada',
  BORRADOR: 'Borrador',
  INACTIVO: 'Inactivo',
  ELIMINADA: 'Eliminada',
};

export function normalizeModalidadCurricula(value: unknown): ModalidadCurricula | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toUpperCase();
  return MODALIDADES_CURRICULA.includes(normalized as ModalidadCurricula)
    ? (normalized as ModalidadCurricula)
    : null;
}

export function normalizeEstadoCurricula(value: unknown): EstadoCurricula | null {
  if (typeof value !== 'string') return null;

  const normalized = value
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');

  return ESTADOS_CURRICULA.includes(normalized as any) || normalized === 'ELIMINADA'
    ? (normalized as EstadoCurricula)
    : null;
}

export function getCurriculaDisplayName(curricula: {
  nombre_carrera: string;
  año_curricula: number;
  modalidad_estudios: string;
}) {
  return `${curricula.nombre_carrera} (${curricula.año_curricula}) - (${curricula.modalidad_estudios})`;
}