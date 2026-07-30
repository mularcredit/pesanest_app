"use client";

import { ExpenseForm } from"@/components/expenses/ExpenseForm";
import Link from"next/link";
import { PiCaretLeft } from"react-icons/pi";
import { useRouter } from"next/navigation";

export default function NewExpensePage() {
 const router = useRouter();

 return (
 <div className="space-y-8 pb-24 animate-fade-in-up px-4 md:px-8">


 <ExpenseForm
 mode="full"
 onSuccess={() => router.push("/dashboard/expenses")}
 onCancel={() => router.push("/dashboard/expenses")}
 />
 </div>
 );
}
