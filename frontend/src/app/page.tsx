import { redirect } from 'next/navigation';

// La raíz redirige al dashboard; el layout de dashboard gestiona la autenticación
export default function RootPage() {
  redirect('/dashboard');
}
