@echo off
REM Deployment script for CogniLearn on Google Cloud Run
set PROJECT_ID=gen-lang-client-0552129677
set SERVICE_NAME=cognilearn
set REGION=us-central1

echo ========================================================
echo Deploying %SERVICE_NAME% to Google Cloud Run
echo Project: %PROJECT_ID%
echo Region:  %REGION%
echo ========================================================

echo 1. Setting active project...
call gcloud config set project %PROJECT_ID%

echo 2. Enabling required Google Cloud APIs...
call gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com

echo 3. Building container with Cloud Build and deploying to Cloud Run...
call gcloud run deploy %SERVICE_NAME% ^
    --source . ^
    --project %PROJECT_ID% ^
    --region %REGION% ^
    --platform managed ^
    --allow-unauthenticated ^
    --memory 2Gi ^
    --cpu 2 ^
    --timeout 300 ^
    --set-env-vars GEMINI_MODEL=gemini-2.5-flash

echo ========================================================
echo Deployment process finished.
echo ========================================================
