-- Seed Data for development

insert into app.users (id, student_code, full_name, email, role) values 
('00000000-0000-4000-a000-000000000001', 'U20212345', 'Juan Perez', 'u20212345@univo.edu.sv', 'STUDENT'),
('00000000-0000-4000-a000-000000000002', 'U20212346', 'Ana Gomez', 'u20212346@univo.edu.sv', 'STUDENT'),
('00000000-0000-4000-a000-000000000003', 'U20240001', 'Coordinador Principal', 'coordinador1@univo.edu.sv', 'COORDINADOR');

insert into app.campuses (id, name, latitude, longitude, radius_meters, created_by) values
('11111111-1111-4111-a111-111111111111', 'Hospital San Juan de Dios', 13.4869, -88.1771, 100, '00000000-0000-4000-a000-000000000003'),
('22222222-2222-4222-a222-222222222222', 'Clinica Medica Univo', 13.7013, -89.2045, 100, '00000000-0000-4000-a000-000000000003');

insert into app.attendances (id, student_id, campus_id, check_in, date, status) values
('33333333-3333-4333-a333-333333333331', '00000000-0000-4000-a000-000000000001', '11111111-1111-4111-a111-111111111111', '2026-04-08 07:15:00-06', '2026-04-08', 'present'),
('33333333-3333-4333-a333-333333333332', '00000000-0000-4000-a000-000000000002', '11111111-1111-4111-a111-111111111111', '2026-04-08 07:30:00-06', '2026-04-08', 'late');
