import { getAssets, getAssetStats } from "./actions";
import { AssetManager } from "./AssetManager";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/access-control";

export const dynamic = 'force-dynamic';

export const metadata = {
    title: "Asset Management | Pesanest",
    description: "Track and manage company assets",
};

export default async function AssetsPage({ searchParams }: { searchParams: { q?: string } }) {
    const session = await auth();
    if (!session?.user) return redirect("/login");
    requirePermission(session, ['ASSETS.VIEW']);

    const query = searchParams?.q || "";
    const { data: assets } = await getAssets(query);
    const stats = await getAssetStats();

    return (
        <div className="space-y-6 pb-24">
            <div>
                <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Asset Management</h1>
                <p className="text-[12.5px] text-gray-400 mt-0.5">Track, manage and optimize your company's physical assets.</p>
            </div>
            <AssetManager assets={assets || []} stats={stats} />
        </div>
    );
}
