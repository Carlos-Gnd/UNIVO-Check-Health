// Crea usuarios de prueba (uno por rol) + una asignación de ejemplo en Supabase Cloud.
// Usa la Admin API con la service_role key, así que las cuentas SÍ pueden iniciar sesión.
// Es idempotente: puedes correrlo varias veces sin duplicar nada.
//
// Uso (la service key se saca del dashboard: Settings → API → service_role):
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJhbGci... \
//   node scripts/seed-test-users.mjs
//
// Contraseña por defecto: Prueba2026!  (cámbiala con TEST_PASSWORD=... si quieres)

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
const PASSWORD = process.env.TEST_PASSWORD || 'Prueba2026!';

if (!URL || !SERVICE_KEY) {
  console.error('\n✗ Faltan variables de entorno.\n  Necesitas SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.\n');
  process.exit(1);
}

const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Email = código en minúsculas + dominio (igual que arma la app).
const email = (code) => `${code.toLowerCase()}@univo.edu.sv`;

const USERS = [
  { code: 'DECANO01',  role: 'ADMIN',       full_name: 'Decano de Prueba',        career: null },
  { code: 'COORD01',   role: 'COORDINATOR', full_name: 'Coordinador de Prueba',   career: null },
  { code: 'DOCENTE01', role: 'DOCENTE',     full_name: 'Docente de Prueba',       career: null },
  { code: 'U20240001', role: 'STUDENT',     full_name: 'Estudiante Uno',          career: 'Enfermería' },
  { code: 'U20240002', role: 'STUDENT',     full_name: 'Estudiante Dos',          career: 'Medicina' },
];

// IDs fijos para que campus y asignación sean idempotentes.
const CAMPUS_ID = 'aaaaaaaa-0000-4000-a000-000000000001';
const ASSIGN_ID = 'bbbbbbbb-0000-4000-a000-000000000001';

async function findUserIdByEmail(targetEmail) {
  // listUsers pagina; para un proyecto de prueba con pocos usuarios basta la primera página grande.
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return data?.users?.find((u) => u.email?.toLowerCase() === targetEmail)?.id ?? null;
}

async function ensureUser(u) {
  const mail = email(u.code);
  let id = null;

  const { data: created, error } = await admin.auth.admin.createUser({
    email: mail,
    password: PASSWORD,
    email_confirm: true,
  });

  if (error) {
    if ((error.message ?? '').toLowerCase().includes('already')) {
      id = await findUserIdByEmail(mail);
      // Reasegura la contraseña por si cambió.
      if (id) await admin.auth.admin.updateUserById(id, { password: PASSWORD });
    } else {
      throw new Error(`Auth (${mail}): ${error.message}`);
    }
  } else {
    id = created.user.id;
  }
  if (!id) throw new Error(`No se pudo resolver el id de ${mail}`);

  const { error: pErr } = await admin.from('users').upsert(
    { id, student_code: u.code, full_name: u.full_name, email: mail, role: u.role, career: u.career },
    { onConflict: 'id' },
  );
  if (pErr) throw new Error(`Perfil (${mail}): ${pErr.message}`);

  console.log(`  ✓ ${u.role.padEnd(11)} ${mail}`);
  return id;
}

async function seedAssignment(ids) {
  const today = new Date();
  const start = today.toISOString().slice(0, 10);
  const end = new Date(today.getTime() + 90 * 86400000).toISOString().slice(0, 10);

  // Sede de ejemplo (Hospital San Juan de Dios, San Miguel).
  const { error: cErr } = await admin.from('campuses').upsert({
    id: CAMPUS_ID,
    name: 'Hospital San Juan de Dios (Prueba)',
    latitude: 13.4833,
    longitude: -88.1833,
    radius_meters: 100,
    location_label: 'San Miguel, El Salvador',
    supervisor_name: 'Dr. Supervisor de Prueba',
    supervisor_phone: '2222-0000',
    check_in_from: '07:00',
    check_in_to: '09:00',
    start_date: start,
    end_date: end,
    is_active: true,
  }, { onConflict: 'id' });
  if (cErr) throw new Error(`Sede: ${cErr.message}`);

  // Asignación: Estudiante Uno → sede, con docente y coordinador.
  const { error: aErr } = await admin.from('teacher_groups').upsert({
    id: ASSIGN_ID,
    teacher_id: ids.DOCENTE01,
    student_id: ids.U20240001,
    coordinator_id: ids.COORD01,
    campus_id: CAMPUS_ID,
    period: '2026-1',
    start_date: start,
    end_date: end,
  }, { onConflict: 'id' });
  if (aErr) throw new Error(`Asignación: ${aErr.message}`);

  // Horario: lunes a viernes 07:00–15:00.
  await admin.from('student_schedules').delete().eq('assignment_id', ASSIGN_ID);
  const slots = [1, 2, 3, 4, 5].map((weekday) => ({
    assignment_id: ASSIGN_ID, weekday, check_in_from: '07:00', check_in_to: '15:00',
  }));
  const { error: sErr } = await admin.from('student_schedules').insert(slots);
  if (sErr) throw new Error(`Horario: ${sErr.message}`);

  console.log('  ✓ Sede + asignación + horario (L–V 07:00–15:00) para Estudiante Uno');
}

async function main() {
  console.log('\nCreando usuarios de prueba…');
  const ids = {};
  for (const u of USERS) ids[u.code] = await ensureUser(u);

  console.log('\nCreando datos de ejemplo…');
  await seedAssignment(ids);

  console.log(`\n✓ Listo. Contraseña para todos: ${PASSWORD}\n`);
}

main().catch((e) => { console.error(`\n✗ ${e.message}\n`); process.exit(1); });
