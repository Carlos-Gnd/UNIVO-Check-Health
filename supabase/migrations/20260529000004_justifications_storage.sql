-- T-17.2: bucket de Storage para documentos de justificaciones.
-- Bucket público (archivos accesibles por URL) con path {user_id}/{timestamp}_{filename}
-- lo que hace que las URLs sean opacas y no adivinables.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'justifications',
  'justifications',
  true,
  10485760, -- 10 MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Solo el propietario puede subir a su carpeta
DROP POLICY IF EXISTS "justif_student_upload" ON storage.objects;
CREATE POLICY "justif_student_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'justifications'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- El propietario puede leer sus archivos
DROP POLICY IF EXISTS "justif_student_read_own" ON storage.objects;
CREATE POLICY "justif_student_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'justifications'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Docentes y coordinadores pueden leer todos los archivos del bucket
DROP POLICY IF EXISTS "justif_reviewer_read_all" ON storage.objects;
CREATE POLICY "justif_reviewer_read_all" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'justifications'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND upper(u.role) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR', 'TEACHER', 'DOCENTE')
    )
  );
