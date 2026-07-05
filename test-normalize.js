
function normalizeText(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Test with the docente from the database
const docente = {
  nombre: 'Robert Jerry',
  apellidos: 'Sánchez Ticona',
  dni: '29292929'
};

const searchQueries = [
  'SÁNCHEZ', 
  'SÁ', 
  'sanchez',
  'ROBERT', 
  'TICONA',
  'SÁNCHEZ TICONA ROBERT JERRY'
];

console.log('Testing normalizeText:');
console.log(`  "SÁNCHEZ" → ${normalizeText('SÁNCHEZ')}`);
console.log(`  "SÁ" → ${normalizeText('SÁ')}`);
console.log(`  "Sánchez Ticona" → ${normalizeText(docente.apellidos)}`);
console.log(`  "Robert Jerry" → ${normalizeText(docente.nombre)}`);

console.log('\nTesting searches:');
searchQueries.forEach(query => {
  const normalizedQuery = normalizeText(query);
  const matchesNombre = normalizeText(docente.nombre).includes(normalizedQuery);
  const matchesApellidos = normalizeText(docente.apellidos).includes(normalizedQuery);
  const matchesDni = normalizeText(docente.dni).includes(normalizedQuery);
  const matches = matchesNombre || matchesApellidos || matchesDni;
  console.log(`Search for "${query}" (${normalizedQuery}):`);
  console.log(`  - nombre: ${matchesNombre}`);
  console.log(`  - apellidos: ${matchesApellidos}`);
  console.log(`  - dni: ${matchesDni}`);
  console.log(`  - MATCHES: ${matches}\n`);
});
