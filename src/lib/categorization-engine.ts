/**
 * Smart Expense Categorization Engine
 * Uses pattern matching and learning from historical data to auto-categorize expenses
 */

interface ExpensePattern {
    merchant: string;
    category: string;
    confidence: number;
}

interface CategorySuggestion {
    category: string;
    confidence: number;
    reason: string;
}

export class ExpenseCategorizationEngine {
    private patterns: Map<string, ExpensePattern[]> = new Map();

    /**
     * Train the model with historical expense data
     */
    async train(expenses: any[]) {
        const merchantCategories = new Map<string, Map<string, number>>();

        // Analyze historical data
        expenses.forEach(expense => {
            const merchant = this.normalizeMerchant(expense.merchant || expense.title);

            if (!merchantCategories.has(merchant)) {
                merchantCategories.set(merchant, new Map());
            }

            const categories = merchantCategories.get(merchant)!;
            categories.set(
                expense.category,
                (categories.get(expense.category) || 0) + 1
            );
        });

        // Build patterns
        merchantCategories.forEach((categories, merchant) => {
            const total = Array.from(categories.values()).reduce((sum, count) => sum + count, 0);
            const patterns: ExpensePattern[] = [];

            categories.forEach((count, category) => {
                patterns.push({
                    merchant,
                    category,
                    confidence: count / total
                });
            });

            // Sort by confidence
            patterns.sort((a, b) => b.confidence - a.confidence);
            this.patterns.set(merchant, patterns);
        });

        return this.patterns.size;
    }

    /**
     * Suggest category for a new expense
     */
    suggestCategory(
        title: string,
        merchant?: string,
        amount?: number,
        description?: string
    ): CategorySuggestion[] {
        const suggestions: CategorySuggestion[] = [];
        const normalizedMerchant = this.normalizeMerchant(merchant || title);

        // 1. Exact merchant match
        if (this.patterns.has(normalizedMerchant)) {
            const patterns = this.patterns.get(normalizedMerchant)!;
            patterns.forEach(pattern => {
                if (pattern.confidence > 0.5) {
                    suggestions.push({
                        category: pattern.category,
                        confidence: pattern.confidence,
                        reason: `${(pattern.confidence * 100).toFixed(0)}% of past expenses from "${pattern.merchant}" were ${pattern.category}`
                    });
                }
            });
        }

        // 2. Fuzzy merchant matching
        if (suggestions.length === 0) {
            this.patterns.forEach((patterns, storedMerchant) => {
                const similarity = this.calculateSimilarity(normalizedMerchant, storedMerchant);
                if (similarity > 0.7) {
                    patterns.forEach(pattern => {
                        const adjustedConfidence = pattern.confidence * similarity;
                        if (adjustedConfidence > 0.4) {
                            suggestions.push({
                                category: pattern.category,
                                confidence: adjustedConfidence,
                                reason: `Similar to "${storedMerchant}" (${(similarity * 100).toFixed(0)}% match)`
                            });
                        }
                    });
                }
            });
        }

        // 3. Keyword-based categorization
        if (suggestions.length === 0) {
            const keywordSuggestion = this.categorizeByKeywords(title, description);
            if (keywordSuggestion) {
                suggestions.push(keywordSuggestion);
            }
        }

        // 4. Amount-based heuristics
        if (amount && suggestions.length === 0) {
            const amountSuggestion = this.categorizeByAmount(amount);
            if (amountSuggestion) {
                suggestions.push(amountSuggestion);
            }
        }

        // Sort by confidence and return top 3
        return suggestions
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 3);
    }

    /**
     * Normalize merchant name for better matching
     */
    private normalizeMerchant(merchant: string): string {
        return merchant
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Calculate similarity between two strings (Levenshtein distance)
     */
    private calculateSimilarity(str1: string, str2: string): number {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;

        if (longer.length === 0) return 1.0;

        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    /**
     * Levenshtein distance algorithm
     */
    private levenshteinDistance(str1: string, str2: string): number {
        const matrix: number[][] = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    /**
     * Categorize based on keywords in title/description
     */
    private categorizeByKeywords(title: string, description?: string): CategorySuggestion | null {
        const text = `${title} ${description || ''}`.toLowerCase();

        const keywords = {
            'Travel': ['flight', 'hotel', 'airbnb', 'uber', 'lyft', 'taxi', 'rental car', 'airline', 'booking'],
            'Meals': ['restaurant', 'cafe', 'coffee', 'lunch', 'dinner', 'breakfast', 'food', 'pizza', 'burger'],
            'Office Supplies': ['staples', 'office depot', 'paper', 'printer', 'ink', 'supplies', 'stationery'],
            'Software': ['saas', 'subscription', 'software', 'license', 'cloud', 'hosting', 'domain'],
            'Marketing': ['ads', 'advertising', 'facebook', 'google ads', 'marketing', 'promotion', 'campaign'],
            'Equipment': ['laptop', 'computer', 'monitor', 'keyboard', 'mouse', 'hardware', 'electronics'],
            'Utilities': ['electricity', 'water', 'internet', 'phone', 'utility', 'bill'],
            'Professional Services': ['consulting', 'legal', 'accounting', 'attorney', 'consultant', 'advisor']
        };

        for (const [category, words] of Object.entries(keywords)) {
            for (const word of words) {
                if (text.includes(word)) {
                    return {
                        category,
                        confidence: 0.7,
                        reason: `Detected keyword "${word}" commonly associated with ${category}`
                    };
                }
            }
        }

        return null;
    }

    /**
     * Categorize based on amount patterns
     */
    private categorizeByAmount(amount: number): CategorySuggestion | null {
        if (amount < 25) {
            return {
                category: 'Meals',
                confidence: 0.5,
                reason: 'Small amounts typically indicate meal expenses'
            };
        } else if (amount > 500 && amount < 2000) {
            return {
                category: 'Travel',
                confidence: 0.5,
                reason: 'Medium-large amounts often indicate travel expenses'
            };
        } else if (amount > 2000) {
            return {
                category: 'Equipment',
                confidence: 0.5,
                reason: 'Large amounts typically indicate equipment or major purchases'
            };
        }

        return null;
    }

    /**
     * Get categorization statistics
     */
    getStats() {
        const totalPatterns = Array.from(this.patterns.values())
            .reduce((sum, patterns) => sum + patterns.length, 0);

        const highConfidencePatterns = Array.from(this.patterns.values())
            .flat()
            .filter(p => p.confidence > 0.8).length;

        return {
            totalMerchants: this.patterns.size,
            totalPatterns,
            highConfidencePatterns,
            accuracy: totalPatterns > 0 ? (highConfidencePatterns / totalPatterns) * 100 : 0
        };
    }
}

// Singleton instance
let engineInstance: ExpenseCategorizationEngine | null = null;

export async function getCategorizationEngine(): Promise<ExpenseCategorizationEngine> {
    if (!engineInstance) {
        engineInstance = new ExpenseCategorizationEngine();

        // Train with historical data
        const prisma = (await import('@/lib/prisma')).default;
        const expenses = await prisma.expense.findMany({
            where: {
                status: { not: 'DRAFT' }
            },
            select: {
                title: true,
                merchant: true,
                category: true,
                amount: true
            }
        });

        await engineInstance.train(expenses);
        console.log('✅ Categorization engine trained with', expenses.length, 'expenses');
    }

    return engineInstance;
}
