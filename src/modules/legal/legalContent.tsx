// Contenido legal de UNIVO Check-Health.
//
// LEGAL_VERSION: súbela (p. ej. a la fecha del cambio) cada vez que se modifique
// cualquiera de los tres documentos → los usuarios deberán volver a aceptar.
//
// NOTA: el texto es un BORRADOR funcional, estructurado para esta aplicación
// (control de asistencia con GPS/IP/dispositivo). Debe ser revisado y aprobado
// por la unidad jurídica de UNIVO antes de producción.

import { type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export const LEGAL_VERSION = '2026-06-05';

const CONTACT_EMAIL = 'privacidad@univo.edu.sv';

function LegalDoc({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-surface to-white">
      <header className="bg-brand-700 text-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <ShieldCheck className="w-6 h-6" />
          <div>
            <p className="text-sm font-semibold leading-tight">UNIVO Check-Health</p>
            <p className="text-[11px] tracking-widest uppercase text-brand-100">Documento legal</p>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-gold-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Volver al inicio
        </Link>
        <h1 className="text-2xl font-bold text-brand-900">{title}</h1>
        <p className="text-xs text-slate-500 mt-1">Última actualización: {updated} · Versión {LEGAL_VERSION}</p>
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Borrador funcional sujeto a revisión por la unidad jurídica de UNIVO.
        </div>
        <div className="prose prose-sm max-w-none mt-6 space-y-5 text-slate-700 [&_h2]:text-brand-900 [&_h2]:font-semibold [&_h2]:text-base [&_h2]:mt-6 [&_h2]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
          {children}
        </div>
        <footer className="mt-10 border-t border-brand-100 pt-4 text-xs text-slate-500">
          ¿Dudas sobre tus datos? Escríbenos a <a className="text-brand-700" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </footer>
      </main>
    </div>
  );
}

export function PrivacyPolicyPage() {
  return (
    <LegalDoc title="Política de Privacidad" updated="5 de junio de 2026">
      <p>
        Esta política explica qué datos personales trata <strong>UNIVO Check-Health</strong> (la
        “Aplicación”), de la Universidad de Oriente (UNIVO), con qué fin y qué derechos tienes. Al
        usar la Aplicación aceptas este tratamiento en los términos descritos.
      </p>

      <h2>1. Responsable del tratamiento</h2>
      <p>Universidad de Oriente (UNIVO), Área de Salud. Contacto: {CONTACT_EMAIL}.</p>

      <h2>2. Datos que recopilamos</h2>
      <ul>
        <li><strong>Identificación institucional:</strong> nombre, carné/código, correo institucional, carrera, nivel académico y rol.</li>
        <li><strong>Ubicación (GPS):</strong> tu posición <em>únicamente en el momento de marcar entrada o salida</em>, para verificar que estás en la sede. No hay rastreo continuo.</li>
        <li><strong>Datos técnicos:</strong> dirección IP y una huella del dispositivo, como señales para detectar fraude o suplantación.</li>
        <li><strong>Registros de práctica:</strong> asistencias, horas, evaluaciones y documentos o fotos que adjuntes en justificaciones.</li>
      </ul>

      <h2>3. Finalidad</h2>
      <p>
        Controlar y certificar la asistencia de estudiantes en prácticas clínicas, prevenir el fraude
        de marcaje y generar reportes académicos. No usamos tus datos con fines publicitarios ni los
        vendemos.
      </p>

      <h2>4. Legitimación</h2>
      <p>La relación académica entre el estudiante y UNIVO, y tu consentimiento al aceptar esta política.</p>

      <h2>5. Conservación</h2>
      <p>
        Conservamos los datos mientras dure tu relación académica y el período de archivo exigido por
        la normativa universitaria; luego se eliminan o anonimizan.
      </p>

      <h2>6. Destinatarios</h2>
      <p>
        Acceden únicamente el personal autorizado (docentes supervisores, coordinación, decanato y
        representantes de sede) según su rol. La infraestructura se aloja en Supabase (proveedor de
        base de datos y autenticación).
      </p>

      <h2>7. Tus derechos</h2>
      <p>
        Puedes solicitar acceso, rectificación o supresión de tus datos escribiendo a {CONTACT_EMAIL}.
        Algunos registros académicos (asistencias certificadas) pueden conservarse por obligación
        institucional aun tras una solicitud de borrado.
      </p>

      <h2>8. Seguridad</h2>
      <p>
        Aplicamos control de acceso por filas (RLS), cifrado en tránsito y mínimo privilegio. Aun así,
        ningún sistema es infalible: protege tu contraseña y no la compartas.
      </p>
    </LegalDoc>
  );
}

export function CookiesPolicyPage() {
  return (
    <LegalDoc title="Política de Cookies y Almacenamiento" updated="5 de junio de 2026">
      <p>
        UNIVO Check-Health <strong>no usa cookies de publicidad ni de seguimiento de terceros</strong>.
        Para funcionar, sí guarda cierta información en tu navegador.
      </p>

      <h2>1. Almacenamiento estrictamente necesario</h2>
      <ul>
        <li><strong>Sesión de autenticación:</strong> Supabase guarda un token de sesión en el almacenamiento local para mantenerte conectado.</li>
        <li><strong>Identificador de dispositivo y de sesión:</strong> un id local para la “sesión única” y para detectar dispositivos compartidos.</li>
        <li><strong>Preferencias de interfaz:</strong> por ejemplo, si el menú lateral está colapsado.</li>
      </ul>

      <h2>2. ¿Puedo desactivarlo?</h2>
      <p>
        Este almacenamiento es necesario para iniciar sesión y marcar asistencia. Si lo bloqueas o
        borras, tendrás que volver a iniciar sesión y la Aplicación podría no funcionar correctamente.
      </p>

      <h2>3. Terceros</h2>
      <p>
        Usamos Supabase (autenticación y datos) y, de forma opcional, notificaciones push. No incrustamos
        rastreadores publicitarios.
      </p>
    </LegalDoc>
  );
}

export function TermsPage() {
  return (
    <LegalDoc title="Términos y Condiciones de Uso" updated="5 de junio de 2026">
      <p>
        Al acceder a UNIVO Check-Health aceptas estos términos. Si no estás de acuerdo, no utilices la
        Aplicación.
      </p>

      <h2>1. Uso permitido</h2>
      <p>
        La Aplicación es para el registro y control de asistencia en prácticas académicas de UNIVO.
        Debes usar tu propia cuenta y mantener la confidencialidad de tu contraseña.
      </p>

      <h2>2. Conducta prohibida</h2>
      <ul>
        <li>Falsear tu ubicación GPS o usar herramientas para simularla.</li>
        <li>Marcar asistencia por otra persona o permitir que marquen por ti.</li>
        <li>Compartir tu cuenta, intentar acceder a datos de terceros o vulnerar la seguridad.</li>
      </ul>

      <h2>3. Veracidad y auditoría</h2>
      <p>
        Cada marcaje genera un registro auditable (hora del servidor, ubicación, IP, dispositivo). El
        uso indebido puede acarrear medidas académicas según la normativa de UNIVO.
      </p>

      <h2>4. Disponibilidad</h2>
      <p>
        Procuramos mantener el servicio disponible, pero puede haber interrupciones por mantenimiento o
        causas ajenas. Ante una falla técnica, sigue el procedimiento alterno que indique tu encargado.
      </p>

      <h2>5. Cambios</h2>
      <p>
        Podemos actualizar estos términos; cuando lo hagamos, se te pedirá aceptarlos de nuevo al
        ingresar.
      </p>
    </LegalDoc>
  );
}
