// Shared helpers for the app's jsPDF-based report exporters
// (ReportExportButton, ManagementReportPdf) — kept here so both can reuse
// the same image-loading and formatting logic instead of duplicating it.

export function fmtMoney(n: number, neg = false): string {
    const abs = Math.abs(n).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (neg || n < 0) ? `(${abs})` : abs;
}

export function csvEsc(v: string) { return `"${v.replace(/"/g, '""')}"`; }

// Fetches a same-origin image URL and returns it as a data URI plus its
// natural dimensions/format, ready for jsPDF's addImage — which needs raw
// image data, not a URL. Same-origin fetch carries the session cookie
// automatically, so this works for both public files and auth-gated
// uploaded logos. Returns null on any failure so a broken/missing image
// never breaks the rest of the export.
export async function loadImageForPdf(url: string): Promise<{ dataUri: string; width: number; height: number; format: string } | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        const dataUri = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
        const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
            img.onerror = reject;
            img.src = dataUri;
        });
        if (!width || !height) return null;
        const mime = dataUri.match(/^data:image\/(\w+);/)?.[1]?.toUpperCase() ?? 'PNG';
        return { dataUri, width, height, format: mime === 'JPG' ? 'JPEG' : mime };
    } catch {
        return null;
    }
}
