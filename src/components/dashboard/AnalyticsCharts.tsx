"use client";

import { useMemo } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    PointElement,
    LineElement,
    Filler
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    PointElement,
    LineElement,
    Filler
);

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";

interface AnalyticsChartsProps {
    categoryData: { name: string, amount: number }[];
    monthlyData: { month: string, expense: number, revenue?: number }[];
    statusData: { status: string, count: number }[];
}

export function AnalyticsCharts({ categoryData, monthlyData, statusData }: AnalyticsChartsProps) {

    const categoryChartData = useMemo(() => ({
        labels: categoryData.map(c => c.name),
        datasets: [
            {
                label: 'Spending by Category',
                data: categoryData.map(c => c.amount),
                backgroundColor: [
                    'rgba(41, 37, 141, 0.8)', // Brand Indigo
                    'rgba(99, 102, 241, 0.7)',
                    'rgba(168, 85, 247, 0.7)',
                    'rgba(244, 114, 182, 0.7)',
                    'rgba(56, 189, 248, 0.7)',
                ],
                borderColor: [
                    '#6366F1',
                    '#6366f1',
                    '#a855f7',
                    '#f472b6',
                    '#38bdf8',
                ],
                borderWidth: 1,
            },
        ],
    }), [categoryData]);

    const monthlyChartData = useMemo(() => ({
        labels: monthlyData.map(m => m.month),
        datasets: [
            {
                fill: true,
                label: 'Revenue',
                data: monthlyData.map(m => m.revenue || 0),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
            },
            {
                fill: true,
                label: 'Expenses',
                data: monthlyData.map(m => m.expense),
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                tension: 0.4,
            },
        ],
    }), [monthlyData]);

    const statusChartData = useMemo(() => ({
        labels: statusData.map(s => s.status),
        datasets: [
            {
                data: statusData.map(s => s.count),
                backgroundColor: [
                    'rgba(16, 185, 129, 0.5)',
                    'rgba(245, 158, 11, 0.5)',
                    'rgba(239, 68, 68, 0.5)',
                    'rgba(107, 114, 128, 0.5)',
                ],
                borderColor: [
                    '#10b981',
                    '#f59e0b',
                    '#ef4444',
                    '#6b7280',
                ],
                borderWidth: 1,
            },
        ],
    }), [statusData]);

    const options = useMemo(() => ({
        responsive: true,
        plugins: {
            legend: {
                position: 'top' as const,
                labels: {
                    usePointStyle: true,
                    boxWidth: 6,
                    font: { size: 10, weight: 'bold' as const },
                    color: '#6b7280'
                }
            },
            tooltip: {
                mode: 'index' as const,
                intersect: false,
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)',
                },
                ticks: {
                    color: '#9ca3af',
                    font: { size: 10, weight: 'bold' as const }
                }
            },
            x: {
                grid: {
                    display: false,
                },
                ticks: {
                    color: '#9ca3af',
                    font: { size: 10, weight: 'bold' as const }
                }
            },
        },
    }), []);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="overflow-hidden">
                <CardHeader>
                    <CardTitle className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        Overview (Revenue vs Expenses)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[250px] w-full">
                        <Line data={monthlyChartData} options={options} />
                    </div>
                </CardContent>
            </Card>

            <Card className="overflow-hidden">
                <CardHeader>
                    <CardTitle className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        Expense Distribution
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[250px] w-full flex justify-center">
                        <Pie
                            data={categoryChartData}
                            options={{
                                responsive: true,
                                plugins: {
                                    legend: {
                                        position: 'right',
                                        labels: {
                                            color: '#6b7280',
                                            font: { size: 10, weight: 'bold' as const }
                                        }
                                    }
                                }
                            }}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card className="overflow-hidden">
                <CardHeader>
                    <CardTitle className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        By Category
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[250px] w-full">
                        <Bar data={categoryChartData} options={options} />
                    </div>
                </CardContent>
            </Card>

            <Card className="overflow-hidden">
                <CardHeader>
                    <CardTitle className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        Approval Status
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[250px] w-full flex justify-center">
                        <Pie
                            data={statusChartData}
                            options={{
                                responsive: true,
                                plugins: {
                                    legend: {
                                        position: 'right',
                                        labels: {
                                            color: '#6b7280',
                                            font: { size: 10, weight: 'bold' as const }
                                        }
                                    }
                                }
                            }}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
