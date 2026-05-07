// Types for the application
export interface Student {
  id: string;
  name: string;
  carnet: string;
  email: string;
  career: string;
  photo?: string;
}

export interface Practice {
  id: string;
  name: string;
  location: string;
  supervisor: string;
  schedule: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface Attendance {
  id: string;
  studentId: string;
  practiceId: string;
  checkIn: string;
  checkOut?: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
}

export interface AttendanceRecord extends Attendance {
  studentName: string;
  practiceName: string;
}
