# Prudence Expense System - Fly.io Deployment Guide

## Prerequisites

1. Install the Fly.io CLI:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. Sign up or log in to Fly.io:
   ```bash
   fly auth signup
   # or
   fly auth login
   ```

## Initial Setup

1. **Create a Fly.io app** (if not already created):
   ```bash
   fly launch --no-deploy
   ```
   
   This will:
   - Create a new app on Fly.io
   - Generate a `fly.toml` configuration file
   - Set up the app name and region

2. **Set up your database**:
   
   You have two options:
   
   **Option A: Use Fly Postgres (Recommended)**
   ```bash
   fly postgres create --name prudence-db
   fly postgres attach --app prudence-expense-system prudence-db
   ```
   
   **Option B: Use external database (e.g., Supabase, PlanetScale)**
   - Set the DATABASE_URL secret (see step 3)

3. **Set environment secrets**:
   ```bash
   # Database URL (if using external DB)
   fly secrets set DATABASE_URL="your-database-url"
   
   # NextAuth configuration
   fly secrets set NEXTAUTH_SECRET="$(openssl rand -base64 32)"
   fly secrets set NEXTAUTH_URL="https://your-app-name.fly.dev"
   
   # Any other environment variables your app needs
   fly secrets set STRIPE_SECRET_KEY="your-stripe-key"
   ```

4. **Run database migrations**:
   ```bash
   # If using Fly Postgres, connect to it first
   fly proxy 5432 -a prudence-db
   
   # In another terminal, run migrations
   npx prisma migrate deploy
   
   # Optionally seed the database
   npm run db:seed
   ```

## Deployment

Deploy your app to Fly.io:

```bash
fly deploy
```

This will:
- Build the Docker image
- Push it to Fly.io
- Deploy the app
- Run health checks

## Post-Deployment

1. **Check app status**:
   ```bash
   fly status
   ```

2. **View logs**:
   ```bash
   fly logs
   ```

3. **Open your app**:
   ```bash
   fly open
   ```

4. **Scale your app** (if needed):
   ```bash
   # Scale to 2 instances
   fly scale count 2
   
   # Scale memory
   fly scale memory 2048
   ```

## Database Management

### Run Prisma Studio on production DB:
```bash
fly proxy 5432 -a prudence-db
# In another terminal
npx prisma studio
```

### Run migrations:
```bash
fly proxy 5432 -a prudence-db
# In another terminal
npx prisma migrate deploy
```

## Useful Commands

- **SSH into your app**: `fly ssh console`
- **View app info**: `fly info`
- **View secrets**: `fly secrets list`
- **Update secrets**: `fly secrets set KEY=value`
- **Restart app**: `fly apps restart`
- **View metrics**: `fly dashboard`

## Troubleshooting

### Build fails:
- Check Dockerfile syntax
- Ensure all dependencies are in package.json
- Review build logs: `fly logs`

### App crashes on startup:
- Check environment variables are set
- Verify DATABASE_URL is correct
- Check logs: `fly logs`

### Database connection issues:
- Verify DATABASE_URL secret is set
- Check Prisma schema matches database
- Ensure migrations are run

## Environment Variables Checklist

Make sure these are set:
- [ ] `DATABASE_URL`
- [ ] `NEXTAUTH_SECRET`
- [ ] `NEXTAUTH_URL`
- [ ] Any API keys (Stripe, etc.)

## Notes

- The app uses a multi-stage Docker build to optimize image size
- Prisma Client is generated during the build process
- The app runs on port 3000 internally
- Fly.io handles HTTPS automatically
- Auto-stop/start is enabled to save costs when idle

## Support

For more information, visit:
- Fly.io Docs: https://fly.io/docs/
- Next.js Deployment: https://nextjs.org/docs/deployment
- Prisma Deployment: https://www.prisma.io/docs/guides/deployment
