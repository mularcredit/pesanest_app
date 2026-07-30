import { BiTrendingUp } from "react-icons/bi";

export default function ForecastingPage() {
    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="flex items-end justify-between">
                <div>
                    <p className="text-gds-text-muted text-sm font-medium tracking-wide">
                        AI-powered expense predictions & trend analysis
                    </p>
                </div>
            </div>

            <div className="gds-glass p-12 text-center">
                <BiTrendingUp className="text-6xl mx-auto mb-4 text-gds-text-muted opacity-20" />
                <h2 className="text-2xl font-semibold text-gds-text-main mb-2">Predictive Analytics</h2>
                <p className="text-gds-text-muted">Machine learning models for expense forecasting and budget optimization.</p>
            </div>
        </div>
    );
}
