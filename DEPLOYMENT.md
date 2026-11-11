# Deploying CogniLearn to Google Cloud Run

**Project Name:** CogniLearn  
**Project ID:** `gen-lang-client-0552129677`  
**Target Platform:** Google Cloud Run (Serverless Container Platform)

---

## 1. Files Created in Project
- **[Dockerfile](file:///c:/Users/akash/OneDrive/Desktop/Agentic%20Learning%20App/Dockerfile)**: Uses `python:3.11-slim`, installs required system and Python packages, bundles `api/`, `src/`, `config/`, `frontend/`, and `vector_store/`, and starts FastAPI on `${PORT}`.
- **[.dockerignore](file:///c:/Users/akash/OneDrive/Desktop/Agentic%20Learning%20App/.dockerignore)**: Excludes local virtual environments (`.venv`), git metadata, secrets (`.env`), and evaluation outputs.
- **[deploy_gcp.bat](file:///c:/Users/akash/OneDrive/Desktop/Agentic%20Learning%20App/deploy_gcp.bat)**: Automated deployment batch script.

---

## 2. Deployment Methods

### Option A: Using Google Cloud Shell (Fastest & Zero Local Setup)
You do not need to install `gcloud` or run Docker locally if you use Google Cloud Shell in your browser.

1. Open **[Google Cloud Shell](https://shell.cloud.google.com/)** in your browser.
2. Ensure project is set to `gen-lang-client-0552129677`:
   ```bash
   gcloud config set project gen-lang-client-0552129677
   ```
3. Upload your project folder (or clone from GitHub).
4. Run the single build & deploy command:
   ```bash
   gcloud run deploy cognilearn \
     --source . \
     --project gen-lang-client-0552129677 \
     --region us-central1 \
     --allow-unauthenticated \
     --memory 2Gi \
     --cpu 2 \
     --set-env-vars GEMINI_MODEL=gemini-2.5-flash
   ```

---

### Option B: Deploying from your Local Terminal

1. **Install Google Cloud SDK**:
   - Download and run the [Google Cloud CLI Installer for Windows](https://cloud.google.com/sdk/docs/install).
2. **Authenticate & Set Project**:
   ```powershell
   gcloud auth login
   gcloud config set project gen-lang-client-0552129677
   ```
3. **Execute Deployment**:
   Run the helper script in the project directory:
   ```powershell
   .\deploy_gcp.bat
   ```
   Or execute directly:
   ```powershell
   gcloud run deploy cognilearn `
     --source . `
     --project gen-lang-client-0552129677 `
     --region us-central1 `
     --allow-unauthenticated `
     --memory 2Gi `
     --cpu 2 `
     --set-env-vars GEMINI_MODEL=gemini-2.5-flash
   ```

---

## 3. Supplying API Secrets on Cloud Run

To configure your `GEMINI_API_KEY` securely on Cloud Run:
```powershell
gcloud run services update cognilearn `
  --region us-central1 `
  --set-env-vars GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"
```
Or manage it through **Google Cloud Secret Manager**.
