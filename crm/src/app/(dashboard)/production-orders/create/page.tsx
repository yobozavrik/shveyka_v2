import { redirect } from 'next/navigation';

export default function ProductionOrderCreateRedirect() {
  redirect('/orders?tab=orders');
}
