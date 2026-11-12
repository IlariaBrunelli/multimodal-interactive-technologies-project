### 1. System Requirements
Before starting, ensure the new machine has the following installed:
* **Node.js** (v18.x or newer is recommended for Nuxt 4) and **npm**
* **Git** (to pull the repository)
* **Cloudflared** (to expose the local server via a tunnel)

### 2. Pull the Repository
Open your terminal or command prompt, clone the project, and navigate into it:
```bash
git clone https://github.com/danielcarrozzo/mita_fadi
cd mita_fadi
```

### 3. Install Dependencies
Install all the required packages using npm:
```bash
npm install
```

### 4. Configure Environment Variables
The application requires several environment variables (like Supabase credentials) to run properly:
1. Copy the provided `.env.example` file to create a new `.env` file:
   ```bash
   cp .env.example .env
   ```
   *(If you are on Windows Command Prompt, use `copy .env.example .env`)*
2. Open the newly created `.env` file and fill in your specific values:
   ```env
   NUXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
   NUXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
   N8N_CAMPUS_CHAT_WEBHOOK=<your-n8n-chat-webhook>
   N8N_CAMPUS_DATA_WEBHOOK=http://localhost:5678/webhook/get-campus-data
   N8N_GUIDED_TOUR_STEPS_WEBHOOK=http://localhost:5678/webhook/get-guided-tour-steps
   ```

### 5. Build and Run the Application
Build the Nuxt application for production and start the preview server. The `--host` flag ensures it binds to your network interfaces so the tunnel can access it:
```bash
npm run build && npm run preview -- --host
```
*The app will now be running locally, typically at `http://localhost:3000`.*

### 6. Start the Cloudflare Tunnel

This project uses camera so here are some notes about it:
- The app is built to be used on mobile devices.
- Usually mobile device browsers block Camera feature used on addresses in local networks.
- HTTP could not let the project work, HTTPS should be used instead.

For this reason is recommended to use Cloudflare Tunnel, a tunneling daemon that proxies traffic from the Cloudflare network to your origins.

Ensure you have downloaded the Cloudflare Tunnel executable. In your project directory, it should appear as a file named `cloudflared.exe`.

Leave the first terminal running. Open a **new, separate terminal window** in the folder containing your `cloudflared.exe` file, and expose your local server:
```powershell
.\cloudflared tunnel --url http://localhost:3000
```
*(If `cloudflared` is installed globally in your system's PATH rather than locally in the folder, you can omit the `.\` and just run `cloudflared tunnel --url http://localhost:3000`)* 

Cloudflare will generate a public URL in the terminal output that you can use to access the app remotely.

---

# n8n Setup, Backup & Restore Guide (Postgres & Worker)

This guide covers how to set up n8n locally using the official Docker repository with PostgreSQL and background workers, and how to use the command line to export and import your workflows and credentials.

## 1. Local Setup and Installation

First, clone the official n8n hosting repository and navigate to the specific setup folder for Postgres and workers.

1. Open your terminal and clone the repository:
   ```bash
   git clone https://github.com/n8n-io/n8n-hosting.git
   cd n8n-hosting/docker-compose/withPostgresAndWorker
   ```

2. Start the Docker containers in the background:
   ```bash
   docker compose up -d
   ```

3. Once it is running, open `http://localhost:5678` in your browser to access the dashboard and set up your owner account.

---

## 2. Importing Workflows and Credentials

When running this specific Docker Compose setup, your main n8n container is typically named `n8n-n8n-1`. To backup your data, you must run the export commands directly against this running container.

You can check the name of the container for example with the command:
```bash
docker ps
```
You will find different names for the postgres, Redis and other containers. The one you want is the main one. It contains `n8n`.

When you use the `--all` flag to export, n8n places all of your workflows into a single JSON file. Because the dashboard's "Import from File" button is only meant for single workflows, **you must use the command line to import a bulk backup file**.

Since n8n is running inside the Docker container, you must first copy the backup files from your computer into the container, and then execute the import commands.

Open your terminal in the folder where your `backup_workflows.json` (and/or `backup_credentials.json`) are located:

**Step A: Copy the backup files into the container's temporary folder:**
```bash
docker cp backup_workflows.json n8n-n8n-1:/tmp/backup_workflows.json
docker cp backup_credentials.json n8n-n8n-1:/tmp/backup_credentials.json
```

**Step B: Run the import commands inside the container:**
```bash
docker exec -it n8n-n8n-1 n8n import:workflow --input=/tmp/backup_workflows.json
docker exec -it n8n-n8n-1 n8n import:credentials --input=/tmp/backup_credentials.json
```

As soon as these commands finish, refresh your n8n dashboard (`http://localhost:5678`) in your browser. You will see all of your workflows and credentials successfully restored!

---

## 3. Exporting Workflows and Credentials

Open your command prompt or PowerShell and run these commands:

**Export all workflows:**
```bash
docker exec -it n8n-n8n-1 n8n export:workflow --all > backup_workflows.json
```

**Export all credentials:**
*(Note: Because credentials are encrypted with a unique key, importing them on a completely different machine might require migrating your encryption key environment variable as well).*
```bash
docker exec -it n8n-n8n-1 n8n export:credentials --all > backup_credentials.json
```

The `.json` backup files will be generated in whatever folder your terminal is currently open in.
