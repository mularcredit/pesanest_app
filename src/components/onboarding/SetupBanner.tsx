'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PiWarning, PiX, PiCheckCircle, PiArrowRight, PiRocket } from 'react-icons/pi';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';

interface SetupStatus {
    isSetupComplete: boolean;
    chartOfAccounts: {
        isComplete: boolean;
        accountCount: number;
        missingAccounts: any[];
    };
    hasCustomers: boolean;
    hasVendors: boolean;
    hasTransactions: boolean;
    setupProgress: number;
}

export function SetupBanner() {
    const router = useRouter();
    const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
    const [isDismissed, setIsDismissed] = useState(false);
    const [isCreatingAccounts, setIsCreatingAccounts] = useState(false);

    useEffect(() => {
        // Check if user has dismissed the banner
        const dismissed = localStorage.getItem('setup-banner-dismissed');
        if (dismissed === 'true') {
            setIsDismissed(true);
            return;
        }

        // Fetch setup status
        fetch('/api/system/setup-status')
            .then(res => res.json())
            .then(data => setSetupStatus(data))
            .catch(err => console.error('Failed to fetch setup status:', err));
    }, []);

    const handleDismiss = () => {
        localStorage.setItem('setup-banner-dismissed', 'true');
        setIsDismissed(true);
    };

    const handleAutoSetup = async () => {
        setIsCreatingAccounts(true);
        try {
            const res = await fetch('/api/system/auto-setup', {
                method: 'POST'
            });
            const data = await res.json();

            if (data.success) {
                // Refresh setup status
                const statusRes = await fetch('/api/system/setup-status');
                const newStatus = await statusRes.json();
                setSetupStatus(newStatus);

                // Show success message
                alert(`✅ Success! Created ${data.created} accounts. Your Chart of Accounts is now ready!`);
            }
        } catch (error) {
            console.error('Auto-setup failed:', error);
            alert('❌ Failed to create accounts. Please try manual setup.');
        } finally {
            setIsCreatingAccounts(false);
        }
    };

    // Don't show if dismissed or setup is complete
    if (isDismissed || !setupStatus || setupStatus.isSetupComplete) {
        return null;
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="relative"
            >
                {/* Chart of Accounts Setup Banner */}
                {!setupStatus.chartOfAccounts.isComplete && (
                    <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-l-4 border-orange-500 p-4 mb-4 rounded-lg shadow-sm">
                        <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                                <PiWarning className="text-orange-600 text-2xl mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                    <h3 className="text-sm font-semibold text-gray-900 mb-1">
                                        Chart of Accounts Setup Required
                                    </h3>
                                    <p className="text-sm text-gray-700 mb-3">
                                        Your accounting system needs a Chart of Accounts to function properly.
                                        {setupStatus.chartOfAccounts.missingAccounts.length > 0 && (
                                            <span className="font-medium text-orange-700">
                                                {' '}Missing {setupStatus.chartOfAccounts.missingAccounts.length} essential accounts.
                                            </span>
                                        )}
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={handleAutoSetup}
                                            disabled={isCreatingAccounts}
                                            size="sm"
                                            className="bg-orange-600 hover:bg-orange-700 text-white"
                                        >
                                            {isCreatingAccounts ? (
                                                <>Creating Accounts...</>
                                            ) : (
                                                <>
                                                    <PiRocket /> Auto-Setup (Recommended)
                                                </>
                                            )}
                                        </Button>
                                        <Button
                                            onClick={() => router.push('/dashboard/accounting/chart-of-accounts')}
                                            size="sm"
                                            variant="outline"
                                        >
                                            Manual Setup <PiArrowRight />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleDismiss}
                                className="text-gray-400 hover:text-gray-600 transition-colors ml-4"
                            >
                                <PiX className="text-xl" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Progress Banner (if CoA is complete but other steps pending) */}
                {setupStatus.chartOfAccounts.isComplete && setupStatus.setupProgress < 100 && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 p-4 mb-4 rounded-lg shadow-sm">
                        <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                                <PiCheckCircle className="text-blue-600 text-2xl mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                    <h3 className="text-sm font-semibold text-gray-900 mb-1">
                                        Setup Progress: {setupStatus.setupProgress}%
                                    </h3>
                                    <p className="text-sm text-gray-700 mb-2">
                                        Great start! Complete these steps to unlock full functionality:
                                    </p>
                                    <ul className="text-sm text-gray-600 space-y-1 mb-3">
                                        {!setupStatus.hasCustomers && (
                                            <li className="flex items-center gap-2">
                                                <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                                                Add your first customer
                                            </li>
                                        )}
                                        {!setupStatus.hasVendors && (
                                            <li className="flex items-center gap-2">
                                                <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                                                Add your first vendor
                                            </li>
                                        )}
                                        {!setupStatus.hasTransactions && (
                                            <li className="flex items-center gap-2">
                                                <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                                                Record your first transaction
                                            </li>
                                        )}
                                    </ul>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                                            style={{ width: `${setupStatus.setupProgress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleDismiss}
                                className="text-gray-400 hover:text-gray-600 transition-colors ml-4"
                            >
                                <PiX className="text-xl" />
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
