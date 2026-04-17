import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get('mes_worker_token')?.value;

  if (!token) {
    redirect('/login');
  }

  const payload = await verifyToken(token);
  
  if (!payload) {
    redirect('/login');
  }

  // Если роль вышивальщик или швея - сразу на задачи
  if (['sewing', 'embroidery', 'cutting', 'overlock', 'straight_stitch', 'coverlock', 'packaging'].includes((payload.role || '').toLowerCase())) {
    redirect('/tasks');
  }

  // Для остальных (мастера, админы) - можно оставить batches или дашборд
  const role = (payload.role || '').toLowerCase();
  if (['master', 'supervisor', 'admin'].includes(role)) {
    redirect('/master');
  }

  redirect('/batches');
}

