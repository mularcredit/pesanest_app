
import OAuthClient from 'intuit-oauth';
import prisma from '@/lib/prisma';

const clientID = process.env.QUICKBOOKS_CLIENT_ID || '';
const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET || '';
const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI || '';
const environment = process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox'; // sandbox or production

export class QuickBooksService {
    private static oauthClient = new OAuthClient({
        clientId: clientID,
        clientSecret: clientSecret,
        environment: environment === 'production' ? 'production' : 'sandbox',
        redirectUri: redirectUri,
    });

    /**
     * Get the Authorization URL for QuickBooks OAuth2
     */
    static getAuthUrl() {
        return this.oauthClient.authorizeUri({
            scope: [OAuthClient.scopes.Accounting, OAuthClient.scopes.OpenId],
            state: 'pesanest-qbo-link',
        });
    }

    /**
     * Exchange the Authorization Code for Tokens
     */
    static async exchangeCode(url: string) {
        try {
            const authResponse = await this.oauthClient.createToken(url);
            const token = authResponse.getJson();
            const realmId = (authResponse as any).realmId;

            // Save to database
            await prisma.quickBooksIntegration.upsert({
                where: { realmId },
                update: {
                    accessToken: token.access_token,
                    refreshToken: token.refresh_token,
                    accessTokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
                    refreshTokenExpiresAt: new Date(Date.now() + token.x_refresh_token_expires_in * 1000),
                    isEnabled: true,
                },
                create: {
                    realmId,
                    accessToken: token.access_token,
                    refreshToken: token.refresh_token,
                    accessTokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
                    refreshTokenExpiresAt: new Date(Date.now() + token.x_refresh_token_expires_in * 1000),
                    isEnabled: true,
                },
            });

            return { success: true, realmId };
        } catch (error: any) {
            console.error('QBO logic exchange error:', error);
            throw new Error(error.message || 'Failed to exchange QBO code');
        }
    }

    /**
     * Get an authenticated OAuth Client
     */
    static async getClient() {
        const integration = await prisma.quickBooksIntegration.findFirst({
            where: { isEnabled: true },
        });

        if (!integration) return null;

        // Check if token is expired (with 5 min buffer)
        if (new Date() >= new Date(integration.accessTokenExpiresAt.getTime() - 5 * 60 * 1000)) {
            // Refresh token
            try {
                this.oauthClient.setToken({
                    access_token: integration.accessToken,
                    refresh_token: integration.refreshToken,
                    expires_in: Math.floor((integration.accessTokenExpiresAt.getTime() - Date.now()) / 1000),
                    x_refresh_token_expires_in: Math.floor((integration.refreshTokenExpiresAt.getTime() - Date.now()) / 1000),
                });

                const authResponse = await this.oauthClient.refresh();
                const token = authResponse.getJson();

                await prisma.quickBooksIntegration.update({
                    where: { id: integration.id },
                    data: {
                        accessToken: token.access_token,
                        refreshToken: token.refresh_token,
                        accessTokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
                        refreshTokenExpiresAt: new Date(Date.now() + token.x_refresh_token_expires_in * 1000),
                    },
                });
            } catch (error) {
                console.error('QBO token refresh failed:', error);
                return null;
            }
        } else {
            this.oauthClient.setToken({
                access_token: integration.accessToken,
                refresh_token: integration.refreshToken,
                expires_in: Math.floor((integration.accessTokenExpiresAt.getTime() - Date.now()) / 1000),
                x_refresh_token_expires_in: Math.floor((integration.refreshTokenExpiresAt.getTime() - Date.now()) / 1000),
            });
        }

        return this.oauthClient;
    }

    /**
     * Fetch QuickBooks Chart of Accounts
     */
    static async fetchAccounts() {
        const client = await this.getClient();
        if (!client) throw new Error('Not connected to QuickBooks');

        const realmId = client.getToken().realmId;
        const url = client.environment === 'production' 
            ? `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=select * from Account maxresults 1000`
            : `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/query?query=select * from Account maxresults 1000`;

        const response = await client.makeApiCall({
            url,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        const data = await response.json();
        return data.QueryResponse.Account || [];
    }
}
