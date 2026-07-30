import { DataImporter } from '@/components/dashboard/DataImporter'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export default async function ImportSettingsPage() {
 const session = await auth()
 if (!session?.user) return redirect("/login")

 // Optional: Check permissions manually if needed, but basic auth is mostly OK for now.
 // Ideally only Admin/Manager/Finance.

 return (
 <div className="space-y-6 pb-24">
 <div>
 <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Data Import</h1>
 <p className="text-[12.5px] text-gray-400 mt-0.5">Bulk upload customers and create invoices from Excel/CSV.</p>
 </div>
 <DataImporter />
 </div>
 )
}
