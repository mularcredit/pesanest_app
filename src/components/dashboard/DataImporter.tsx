'use client'

import { useState } from 'react'
import { read, utils, writeFile } from 'xlsx'
import { PiUploadSimple, PiDownloadSimple, PiCheckCircle, PiWarning, PiSpinner, PiUsers, PiInvoice } from 'react-icons/pi'
import { motion, AnimatePresence } from 'framer-motion'
import { importCustomers, importSales } from '@/app/actions/bulk-import'
import { useToast } from '@/components/ui/ToastProvider' // Creating generic hook connection

export function DataImporter() {
    const [mode, setMode] = useState<'CUSTOMERS' | 'SALES'>('CUSTOMERS')
    const [file, setFile] = useState<File | null>(null)
    const [previewData, setPreviewData] = useState<any[]>([])
    const [isProcessing, setIsProcessing] = useState(false)
    const [importResult, setImportResult] = useState<{ success: boolean; message: string; errors?: string[] } | null>(null)

    // --- Template Generators ---
    const downloadTemplate = () => {
        let data = []
        let filename = ""

        if (mode === 'CUSTOMERS') {
            data = [{
                name: "Acme Corp",
                email: "contact@acme.com",
                phone: "+1 555 0123",
                taxId: "TAX-12345",
                address: "123 Main St",
                city: "Nairobi",
                country: "Kenya",
                currency: 'KES'
            }]
            filename = "customers_template.xlsx"
        } else {
            // Sales Template
            data = [{
                invoiceNumber: "INV-2024-001",
                customerName: "Acme Corp", // Must match existing customer
                issueDate: "2024-02-01",
                dueDate: "2024-03-01",
                description: "Consulting Services",
                quantity: 10,
                unitPrice: 150
            },
            {
                invoiceNumber: "INV-2024-001", // Method to add multiple lines to same invoice
                customerName: "Acme Corp",
                issueDate: "2024-02-01",
                dueDate: "2024-03-01",
                description: "Travel Expenses",
                quantity: 1,
                unitPrice: 500
            }]
            filename = "sales_template.xlsx"
        }

        const ws = utils.json_to_sheet(data)
        const wb = utils.book_new()
        utils.book_append_sheet(wb, ws, "Template")
        writeFile(wb, filename)
    }

    // --- File Handler ---
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (!selectedFile) return

        setFile(selectedFile)
        setImportResult(null)

        const reader = new FileReader()
        reader.onload = (evt) => {
            const bstr = evt.target?.result
            const wb = read(bstr, { type: 'binary' })
            const wsname = wb.SheetNames[0]
            const ws = wb.Sheets[wsname]
            const jsonData = utils.sheet_to_json(ws)
            setPreviewData(jsonData)
        }
        reader.readAsBinaryString(selectedFile)
    }

    // --- Submit Handler ---
    const handleImport = async () => {
        if (!previewData.length) return
        setIsProcessing(true)
        setImportResult(null)

        try {
            let result
            if (mode === 'CUSTOMERS') {
                result = await importCustomers(previewData)
            } else {
                result = await importSales(previewData)
            }
            setImportResult(result)
            if (result.success) {
                setFile(null)
                setPreviewData([]) // Clear on success
            }
        } catch (error) {
            setImportResult({ success: false, message: "System error during import." })
        } finally {
            setIsProcessing(false)
        }
    }

    return (
 <div className="glass-card glass-frost overflow-hidden">
            {/* Header Tabs */}
            <div className="flex border-b border-gray-100">
                <button
                    onClick={() => { setMode('CUSTOMERS'); setPreviewData([]); setFile(null); setImportResult(null); }}
                    className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${mode === 'CUSTOMERS' ? 'text-indigo-600 bg-indigo-50/50 border-b-2 border-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <PiUsers className="text-lg" />
                    Import Customers
                </button>
                <button
                    onClick={() => { setMode('SALES'); setPreviewData([]); setFile(null); setImportResult(null); }}
                    className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${mode === 'SALES' ? 'text-cyan-600 bg-cyan-50/50 border-b-2 border-cyan-600' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <PiInvoice className="text-lg" />
                    Import Sales
                </button>
            </div>

            <div className="p-8">
                {/* Mode Description */}
                <div className="mb-8 text-center max-w-lg mx-auto">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Bulk Import {mode === 'CUSTOMERS' ? 'Customers' : 'Sales Invoices'}
                    </h3>
                    <p className="text-sm text-gray-500 mb-6">
                        {mode === 'CUSTOMERS'
                            ? "Upload a list of customers to add them to your database. Existing customers with matching names will be updated."
                            : "Upload invoices. Rows with the same Invoice Number will be grouped into a single invoice. Ensure customers exist before importing sales."}
                    </p>

                    <button
                        onClick={downloadTemplate}
                        className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-full transition-colors"
                    >
                        <PiDownloadSimple />
                        Download {mode === 'CUSTOMERS' ? 'Customer' : 'Sales'} Template
                    </button>
                </div>

                {/* Upload Zone */}
                {!previewData.length ? (
                    <label className="block w-full border-2 border-dashed border-gray-200 rounded-xl p-12 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/10 transition-all group">
                        <input type="file" accept=".csv, .xlsx, .xls" className="hidden" onChange={handleFileUpload} />
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-indigo-100 transition-colors">
                            <PiUploadSimple className="text-2xl text-gray-400 group-hover:text-indigo-600" />
                        </div>
                        <p className="text-sm font-semibold text-gray-700">Click to upload or drag and drop</p>
                        <p className="text-xs text-gray-400 mt-1">Excel (.xlsx) or CSV files supported</p>
                    </label>
                ) : (
                    <div className="space-y-6">
                        {/* File Info */}
                        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-lg p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                    <PiCheckCircle className="text-xl" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">{file?.name}</p>
                                    <p className="text-xs text-gray-500">{previewData.length} rows found</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setFile(null); setPreviewData([]); setImportResult(null); }}
                                className="text-xs font-semibold text-red-500 hover:text-red-700 px-3 py-1"
                            >
                                Remove
                            </button>
                        </div>

                        {/* Preview Table (First 5 rows) */}
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Preview (First 5 Rows)
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left">
 <thead className="text-gray-500 font-medium border-b border-gray-100">
                                        <tr className="bg-gray-50/50">
                                            {Object.keys(previewData[0] || {}).slice(0, 5).map(key => (
                                                <th key={key} className="px-4 py-3">{key}</th>
                                            ))}
                                        </tr>
                                    </thead>
 <tbody className="divide-y divide-gray-100">
                                        {previewData.slice(0, 5).map((row, i) => (
                                            <tr key={i}>
                                                {Object.values(row).slice(0, 5).map((val: any, j) => (
                                                    <td key={j} className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{val}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {previewData.length > 5 && (
                                <div className="bg-gray-50 px-4 py-2 text-[10px] text-center text-gray-400 font-medium">
                                    ...and {previewData.length - 5} more rows
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-end gap-3 pt-4">
                            <button
                                disabled={isProcessing}
                                onClick={handleImport}
                                className="gds-btn-premium w-full md:w-auto flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isProcessing ? (
                                    <>
                                        <PiSpinner className="animate-spin text-lg" />
                                        Importing Data...
                                    </>
                                ) : (
                                    <>
                                        <PiCheckCircle className="text-lg" />
                                        Confirm Import
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Status Messages */}
                {importResult && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`mt-6 p-4 rounded-xl border ${importResult.success ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'}`}
                    >
                        <h4 className="text-sm font-semibold flex items-center gap-2 mb-1">
                            {importResult.success ? <PiCheckCircle className="text-lg" /> : <PiWarning className="text-lg" />}
                            {importResult.success ? "Import Successful" : "Import Failed"}
                        </h4>
                        <p className="text-xs opacity-90">{importResult.message}</p>

                        {importResult.errors && (
                            <div className="mt-3 bg-white/50 rounded-lg p-3 max-h-40 overflow-y-auto text-xs font-mono space-y-1">
                                {importResult.errors.map((err, i) => (
                                    <div key={i} className="text-red-700">• {err}</div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </div>
        </div>
    )
}
