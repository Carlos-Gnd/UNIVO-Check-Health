-- T-28.1: permitir que el docente lea su propio historial de decisiones.
-- La vista de historial filtra por actor_user_id = auth.uid(); esta politica
-- mantiene el alcance en audit_log limitado a decisiones/escalamientos propios.

DROP POLICY IF EXISTS "teacher_reads_own_decision_history" ON public.audit_log;

CREATE POLICY "teacher_reads_own_decision_history" ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    actor_user_id = auth.uid()
    AND action IN ('JUSTIFICATION_REVIEWED', 'JUSTIFICATION_ESCALATED')
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND UPPER(u.role) IN ('DOCENTE', 'TEACHER')
    )
  );
