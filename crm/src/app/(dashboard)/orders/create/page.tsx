import { redirect } from 'next/navigation';

export default function CreateOrderPage() {
  redirect('/orders?tab=orders');
}
