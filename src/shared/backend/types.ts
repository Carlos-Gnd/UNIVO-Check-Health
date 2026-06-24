export type UserRole = 'Estudiante' | 'Docente' | 'Coordinador' | 'Representante de sede' | 'Administrador';

export interface SessionCredential {
  token: string;
  expiresAt: string;
  type: 'short' | 'long';
}

export interface UserSession {
  userId: string;
  email: string;
  role: UserRole;
  access: string[];
  shortLived: SessionCredential;
  longLived: SessionCredential;
  createdAt: string;
  revokedAt?: string;
}
