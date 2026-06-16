# Deploying to GitHub Pages

## Prerequisites
- A GitHub account
- A GitHub repository (create one if you don't have it yet)

## Step 1: Confirm GitHub Pages Path

1. This app is configured for the repository Pages URL:
   ```text
   https://tinykings.github.io/juice/
   ```
2. Keep `next.config.ts` configured with `basePath: "/juice"` and no `public/CNAME` file.

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
https://tinykings.github.io/juice/
```

## Important Notes

- The `.nojekyll` file is automatically created to prevent Jekyll processing
- The site will automatically rebuild and deploy on every push to `main` (if using GitHub Actions)
- The app uses `/juice` as its Next.js `basePath`, matching the GitHub Pages repository path

## Troubleshooting

- **404 errors**: Confirm GitHub Pages is using GitHub Actions and the repository name is `juice`
- **Assets not loading**: Check that generated asset URLs include `/juice/_next/`
- **Build fails**: Check GitHub Actions logs in the **Actions** tab
