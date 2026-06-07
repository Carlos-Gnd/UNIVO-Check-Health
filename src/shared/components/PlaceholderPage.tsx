import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { PageHeader } from '@/shared/components/PageHeader';

export function PlaceholderPage({ title, note }: { title: string; note?: string }) {
  return (
    <div className="space-y-4">
      <PageHeader title={title} description={note ?? 'Este apartado se integrará en la siguiente fase del proyecto.'} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximamente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            {note ?? 'Este apartado se integrará en la siguiente fase del proyecto.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
