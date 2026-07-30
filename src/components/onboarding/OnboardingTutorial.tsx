'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    PiX,
    PiArrowRight,
    PiArrowLeft,
    PiCheckCircle,
    PiBookOpenText,
    PiChartPieSlice,
    PiReceipt,
    PiUsers,
    PiRocket
} from 'react-icons/pi';
import { Button } from '@/components/ui/Button';

const appName = process.env.NEXT_PUBLIC_APP_NAME || 'CapitalPay';

const tutorialSteps = [
    {
        title: `Welcome to ${appName}!`,
        icon: PiRocket,
        description: 'Your complete expense management and accounting system',
        content: (
            <div className="space-y-3">
                <p className="text-slate-300 text-xs leading-relaxed">
                    {appName} helps you manage expenses, track finances, and maintain accurate accounting records—all in one place.
                </p>
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                    <h4 className="font-semibold text-slate-200 mb-2 text-xs">What you can do:</h4>
                    <ul className="space-y-1.5 text-xs text-slate-400">
                        <li className="flex items-start gap-2">
                            <PiCheckCircle className="text-indigo-400 mt-0.5 flex-shrink-0 text-sm" />
                            <span>Submit and approve expenses with multi-level workflows</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <PiCheckCircle className="text-indigo-400 mt-0.5 flex-shrink-0 text-sm" />
                            <span>Manage customers, vendors, and invoices</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <PiCheckCircle className="text-indigo-400 mt-0.5 flex-shrink-0 text-sm" />
                            <span>Maintain a complete General Ledger with double-entry bookkeeping</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <PiCheckCircle className="text-indigo-400 mt-0.5 flex-shrink-0 text-sm" />
                            <span>Generate professional financial statements and reports</span>
                        </li>
                    </ul>
                </div>
            </div>
        )
    },
    {
        title: 'Chart of Accounts',
        icon: PiBookOpenText,
        description: 'The foundation of your accounting system',
        content: (
            <div className="space-y-3">
                <p className="text-slate-300 text-xs leading-relaxed">
                    The <strong className="text-white">Chart of Accounts</strong> is a list of all accounts used to categorize your financial transactions.
                </p>
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                    <h4 className="font-semibold text-slate-200 mb-2 text-xs">Account Types:</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-900/50 rounded p-2 border border-slate-700/30">
                            <p className="font-semibold text-blue-400 text-xs">Assets</p>
                            <p className="text-[10px] text-slate-500">What you own (Cash, AR)</p>
                        </div>
                        <div className="bg-slate-900/50 rounded p-2 border border-slate-700/30">
                            <p className="font-semibold text-blue-400 text-xs">Liabilities</p>
                            <p className="text-[10px] text-slate-500">What you owe (AP, Loans)</p>
                        </div>
                        <div className="bg-slate-900/50 rounded p-2 border border-slate-700/30">
                            <p className="font-semibold text-blue-400 text-xs">Equity</p>
                            <p className="text-[10px] text-slate-500">Owner's stake</p>
                        </div>
                        <div className="bg-slate-900/50 rounded p-2 border border-slate-700/30">
                            <p className="font-semibold text-blue-400 text-xs">Revenue</p>
                            <p className="text-[10px] text-slate-500">Income from sales</p>
                        </div>
                        <div className="bg-slate-900/50 rounded p-2 border border-slate-700/30 col-span-2">
                            <p className="font-semibold text-blue-400 text-xs">Expenses</p>
                            <p className="text-[10px] text-slate-500">Costs of doing business</p>
                        </div>
                    </div>
                </div>
                <p className="text-[10px] text-slate-500">
                    💡 <strong className="text-slate-400">Tip:</strong> We've created a standard Chart of Accounts for you. You can customize it anytime!
                </p>
            </div>
        )
    },
    {
        title: 'General Ledger',
        icon: PiChartPieSlice,
        description: 'Your complete transaction history',
        content: (
            <div className="space-y-3">
                <p className="text-slate-300 text-xs leading-relaxed">
                    The <strong className="text-white">General Ledger</strong> records every financial transaction using double-entry bookkeeping.
                </p>
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                    <h4 className="font-semibold text-slate-200 mb-2 text-xs">How it works:</h4>
                    <div className="space-y-2 text-xs">
                        <div className="bg-slate-900/50 rounded p-2 border border-slate-700/30">
                            <p className="font-semibold text-emerald-400 mb-1 text-xs">Every transaction has two sides:</p>
                            <div className="flex gap-3 mt-1.5">
                                <div className="flex-1">
                                    <p className="text-[10px] font-semibold text-slate-400">DEBIT</p>
                                    <p className="text-[10px] text-slate-500">Increases assets/expenses</p>
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-semibold text-slate-400">CREDIT</p>
                                    <p className="text-[10px] text-slate-500">Increases liabilities/revenue</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-900/50 rounded p-2 border border-slate-700/30">
                            <p className="font-semibold text-emerald-400 mb-1 text-xs">Example: Expense Payment</p>
                            <div className="text-[10px] text-slate-400 space-y-0.5">
                                <p>DEBIT: Operating Expenses $500</p>
                                <p>CREDIT: Cash & Bank $500</p>
                            </div>
                        </div>
                    </div>
                </div>
                <p className="text-[10px] text-slate-500">
                    💡 <strong className="text-slate-400">Tip:</strong> Most transactions post automatically, but you can create manual entries too!
                </p>
            </div>
        )
    },
    {
        title: 'Expense Workflow',
        icon: PiReceipt,
        description: 'Submit, approve, and pay expenses',
        content: (
            <div className="space-y-3">
                <p className="text-slate-300 text-xs leading-relaxed">
                    {appName} uses a <strong className="text-white">maker-checker workflow</strong> to ensure proper expense control.
                </p>
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                    <h4 className="font-semibold text-slate-200 mb-2 text-xs">Workflow Steps:</h4>
                    <div className="space-y-1.5">
                        {[
                            { step: '1', label: 'Submit', desc: 'Employee submits expense with receipt' },
                            { step: '2', label: 'Approve', desc: 'Manager reviews and approves' },
                            { step: '3', label: 'Batch', desc: 'Finance creates payment batch' },
                            { step: '4', label: 'Authorize', desc: 'Checker authorizes payment' },
                            { step: '5', label: 'Disburse', desc: 'Payment sent & posted to GL' }
                        ].map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2 bg-slate-900/50 rounded p-2 border border-slate-700/30">
                                <div className="w-5 h-5 rounded-full bg-purple-600/80 text-white flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
                                    {item.step}
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-purple-400 text-xs">{item.label}</p>
                                    <p className="text-[10px] text-slate-500">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    },
    {
        title: 'Customers & Vendors',
        icon: PiUsers,
        description: 'Manage your business relationships',
        content: (
            <div className="space-y-3">
                <p className="text-slate-300 text-xs leading-relaxed">
                    Track who you sell to and who you buy from.
                </p>
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                        <h4 className="font-semibold text-cyan-400 mb-1.5 text-xs">Customers</h4>
                        <ul className="space-y-0.5 text-[10px] text-slate-400">
                            <li>• Create sales invoices</li>
                            <li>• Track payments</li>
                            <li>• Generate statements</li>
                            <li>• Monitor AR balance</li>
                        </ul>
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                        <h4 className="font-semibold text-orange-400 mb-1.5 text-xs">Vendors</h4>
                        <ul className="space-y-0.5 text-[10px] text-slate-400">
                            <li>• Record invoices</li>
                            <li>• Schedule payments</li>
                            <li>• Track AP balance</li>
                            <li>• Manage contracts</li>
                        </ul>
                    </div>
                </div>
                <p className="text-[10px] text-slate-500">
                    💡 <strong className="text-slate-400">Tip:</strong> All transactions with customers/vendors automatically update your General Ledger!
                </p>
            </div>
        )
    }
];

export function OnboardingTutorial() {
    const [isOpen, setIsOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [hasSeenTutorial, setHasSeenTutorial] = useState(true);

    useEffect(() => {
        // Check if user has seen the tutorial
        const seen = localStorage.getItem('onboarding-tutorial-seen');
        if (!seen) {
            setHasSeenTutorial(false);
            // Auto-open after a short delay
            setTimeout(() => setIsOpen(true), 1000);
        }
    }, []);

    const handleClose = () => {
        setIsOpen(false);
        localStorage.setItem('onboarding-tutorial-seen', 'true');
        setHasSeenTutorial(true);
    };

    const handleNext = () => {
        if (currentStep < tutorialSteps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleClose();
        }
    };

    const handlePrevious = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleSkip = () => {
        handleClose();
    };

    const step = tutorialSteps[currentStep];

    return (
        <>
            {/* Reopen Tutorial Button (if dismissed) */}
            {hasSeenTutorial && !isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 bg-slate-900 text-white rounded-full p-3 shadow-xl hover:bg-slate-800 transition-all hover:scale-110 z-40 border border-slate-700"
                    title="Reopen Tutorial"
                >
                    <PiBookOpenText className="text-xl" />
                </button>
            )}

            {/* Tutorial Modal */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50"
                            onClick={handleSkip}
                        />

                        {/* Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="bg-slate-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden border border-slate-700/50">
                                {/* Header */}
                                <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 text-white px-6 py-5 relative border-b border-slate-700/50">
                                    <button
                                        onClick={handleSkip}
                                        className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                                    >
                                        <PiX className="text-lg" />
                                    </button>
                                    <div>
                                        <h2 className="text-lg font-semibold mb-0.5 text-white">{step.title}</h2>
                                        <p className="text-slate-400 text-xs">{step.description}</p>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-6 overflow-y-auto max-h-[50vh] bg-slate-900">
                                    {step.content}
                                </div>

                                {/* Footer */}
                                <div className="border-t border-slate-700/50 px-6 py-4 bg-slate-950">
                                    {/* Progress Dots */}
                                    <div className="flex justify-center gap-1.5 mb-4">
                                        {tutorialSteps.map((_, idx) => (
                                            <div
                                                key={idx}
                                                className={`h-1 rounded-full transition-all ${idx === currentStep
                                                    ? 'bg-indigo-500 w-6'
                                                    : idx < currentStep
                                                        ? 'bg-indigo-600/50 w-1'
                                                        : 'bg-slate-700 w-1'
                                                    }`}
                                            />
                                        ))}
                                    </div>

                                    {/* Navigation */}
                                    <div className="flex justify-between items-center">
                                        <Button
                                            onClick={handlePrevious}
                                            disabled={currentStep === 0}
                                            variant="outline"
                                            size="sm"
                                            className="text-xs border-slate-600 bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white hover:border-slate-500 disabled:opacity-30 disabled:bg-slate-900 disabled:text-slate-600 disabled:border-slate-800"
                                        >
                                            <PiArrowLeft className="text-sm" /> Previous
                                        </Button>

                                        <button
                                            onClick={handleSkip}
                                            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                                        >
                                            Skip Tutorial
                                        </button>

                                        <Button
                                            onClick={handleNext}
                                            size="sm"
                                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs shadow-lg shadow-indigo-500/20"
                                        >
                                            {currentStep === tutorialSteps.length - 1 ? (
                                                <>Get Started <PiCheckCircle className="text-sm" /></>
                                            ) : (
                                                <>Next <PiArrowRight className="text-sm" /></>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
