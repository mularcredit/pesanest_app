/**
 * PesaLink Payment Service (Simulated)
 * In a real implementation, this would integrate with a Kenyan bank API
 * or a payment gateway like Cellulant, Flutterwave, or Pesapal.
 */

export interface PesaLinkTransferRequest {
    amount: number;
    phoneNumber?: string;
    accountNumber?: string;
    bankCode?: string;
    reason: string;
    reference: string;
}

export const PESALINK_BANKS = [
    { code: '01', name: 'Kenya Commercial Bank (KCB)' },
    { code: '11', name: 'Co-operative Bank' },
    { code: '63', name: 'Diamond Trust Bank (DTB)' },
    { code: '02', name: 'Standard Chartered' },
    { code: '03', name: 'Barclays (Absa)' },
    { code: '43', name: 'Eco Bank' },
    { code: '68', name: 'Equity Bank' },
    { code: '07', name: 'I&M Bank' },
    { code: '12', name: 'Family Bank' },
];

export class PesaLinkService {
    private static instance: PesaLinkService;
    private apiKey: string;

    private constructor() {
        this.apiKey = process.env.PESALINK_API_KEY || 'mock_key';
    }

    public static getInstance(): PesaLinkService {
        if (!PesaLinkService.instance) {
            PesaLinkService.instance = new PesaLinkService();
        }
        return PesaLinkService.instance;
    }

    /**
     * Send money via PesaLink
     */
    async sendMoney(request: PesaLinkTransferRequest) {
        console.log(`[PesaLink] Initiating transfer of ${request.amount} to ${request.phoneNumber || request.accountNumber}`);

        // Simulate API latency
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Simulate validation
        if (request.amount <= 0) {
            throw new Error('Invalid amount');
        }

        if (request.amount > 999999) {
            throw new Error('Amount exceeds PesaLink daily limit');
        }

        // Mock success response
        return {
            status: 'SUCCESS',
            transactionId: `PL-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
            reference: request.reference,
            timestamp: new Date().toISOString(),
            recipient: request.phoneNumber || request.accountNumber,
            message: 'Transfer successful via PesaLink'
        };
    }

    /**
     * Verify a bank account via PesaLink
     */
    async verifyAccount(accountNumber: string, bankCode: string) {
        await new Promise(resolve => setTimeout(resolve, 800));
        return {
            isValid: true,
            accountName: 'SIMULATED USER ACCOUNT',
        };
    }
}

export const pesalink = PesaLinkService.getInstance();
