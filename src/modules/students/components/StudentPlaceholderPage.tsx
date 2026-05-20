import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

export function StudentPlaceholderPage({ title }: { title: string }) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-gray-900">{title}</h2>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximamente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Este apartado está reservado para el rol Alumno y se integrará en la siguiente fase.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
