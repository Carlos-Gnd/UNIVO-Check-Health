-- Q-02 - Documentos de justificaciones privados con URLs firmadas.

UPDATE storage.buckets
SET public = false
WHERE id = 'justifications';

DROP POLICY IF EXISTS "justif_student_upload" ON storage.objects;
CREATE POLICY "justif_student_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'justifications'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "justif_student_read_own" ON storage.objects;
CREATE POLICY "justif_student_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'justifications'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "justif_reviewer_read_all" ON storage.objects;
CREATE POLICY "justif_reviewer_read_all" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'justifications'
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND upper(u.role) IN ('ADMIN', 'COORDINATOR', 'COORDINADOR', 'TEACHER', 'DOCENTE')
    )
  );

DROP POLICY IF EXISTS "justif_student_update_own" ON storage.objects;
CREATE POLICY "justif_student_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'justifications'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'justifications'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "justif_student_delete_own" ON storage.objects;
CREATE POLICY "justif_student_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'justifications'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
