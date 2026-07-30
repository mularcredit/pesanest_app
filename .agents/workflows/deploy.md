---
description: Deploy the application while ensuring a safety backup on GitHub
---

This workflow ensures that every production deployment is preceded by a Git commit and push to GitHub, preventing any loss of code.

1. **Stage and Commit all changes**
// turbo
2. Run `git add .`
3. Run `git commit -m "Deployment update: $(date)"` (or a custom message provided by the user)

4. **Safety Backup to GitHub**
// turbo
5. Run `git push origin main`

6. **Deploy to Fly.io**
// turbo
7. Run `fly deploy`

8. **Verification**
9. Visit the live site to confirm changes.
