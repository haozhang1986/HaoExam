import subprocess
import sys
from datetime import datetime

def run_command(command):
    try:
        result = subprocess.run(command, shell=True, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        print(result.stdout)
    except subprocess.CalledProcessError as e:
        print(f"Error executing {command}:")
        print(e.stderr)
        sys.exit(1)

def sync_git():
    print("Starting Git Sync...")
    
    # 1. Add all changes
    print("Step 1: Adding files...")
    run_command("git add .")
    
    # 2. Commit
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    message = f"Auto-sync: {timestamp}"
    print(f"Step 2: Committing with message '{message}'...")
    # Allow empty commits just in case nothing changed but we want to push
    try:
        subprocess.run(f'git commit -m "{message}"', shell=True, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except subprocess.CalledProcessError:
        print("Nothing to commit.")

    # 3. Push
    print("Step 3: Pushing to remote...")
    # Check if remote exists
    try:
        subprocess.run("git remote get-url origin", shell=True, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        run_command("git push origin master")
        print("Successfully synced to GitHub!")
    except subprocess.CalledProcessError:
        print("Error: No remote 'origin' configured. Please add your GitHub repo url first:")
        print("git remote add origin <your-github-repo-url>")

if __name__ == "__main__":
    sync_git()
