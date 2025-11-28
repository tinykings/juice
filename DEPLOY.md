# Deploying to GitHub Pages

## Prerequisites
- A GitHub account
- A GitHub repository (create one if you don't have it yet)

## Step 1: Update Repository Name in Config

1. Open `next.config.ts`
2. Change the `basePath` from `/juice` to match your repository name:
   ```typescript
   basePath: process.env.NODE_ENV === 'production' ? '/your-repo-name' : '',
   ```
   Replace `your-repo-name` with your actual repository name.

## Step 2: Push Code to GitHub

1. Initialize git (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. Add your GitHub repository as remote:
   ```bash
   git remote add origin https://github.com/your-username/your-repo-name.git
   ```

3. Push to GitHub:
   ```bash
   git branch -M main
   git push -u origin main
   ```

## Step 3: Enable GitHub Pages

### Option A: Automatic Deployment (Recommended)

1. Go to your repository on GitHub
2. Click on **Settings** tab
3. Scroll down to **Pages** in the left sidebar
4. Under **Source**, select:
   - **Source**: `GitHub Actions`
5. The GitHub Actions workflow will automatically deploy when you push to `main`

### Option B: Manual Deployment

1. Build the site locally:
   ```bash
   npm run deploy
   ```

2. Create a `gh-pages` branch (if it doesn't exist):
   ```bash
   git checkout --orphan gh-pages
   git rm -rf .
   ```

3. Copy the `out` folder contents to the root:
   ```bash
   cp -r out/* .
   git add .
   git commit -m "Deploy to GitHub Pages"
   git push origin gh-pages
   ```

4. Go to repository **Settings** → **Pages**
5. Under **Source**, select:
   - **Branch**: `gh-pages`
   - **Folder**: `/ (root)`
6. Click **Save**

## Step 4: Access Your Site

After deployment, your site will be available at:
```
https://your-username.github.io/your-repo-name/
```

## Important Notes

- The `.nojekyll` file is automatically created to prevent Jekyll processing
- The site will automatically rebuild and deploy on every push to `main` (if using GitHub Actions)
- Make sure your repository name matches the `basePath` in `next.config.ts`
- If you change the repository name, update the `basePath` and redeploy

## Troubleshooting

- **404 errors**: Make sure `basePath` matches your repository name exactly
- **Assets not loading**: Check that paths use relative URLs (they should with `basePath`)
- **Build fails**: Check GitHub Actions logs in the **Actions** tab

