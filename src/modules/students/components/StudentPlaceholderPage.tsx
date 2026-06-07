import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { PageHeader } from '@/shared/components/PageHeader';

export function StudentPlaceholderPage({ title }: { title: string }) {
  return (
    <div className="space-y-4">
      <PageHeader title={title} description="Este apartado está reservado para el rol Alumno y se integrará en la siguiente fase." />
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
