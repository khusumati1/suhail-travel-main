import { spawn } from 'child_process';

console.log('🚀 Starting Suhail Travel Platform (Frontend + Backend)...');

const frontend = spawn('npm', ['run', 'dev:frontend'], { stdio: 'inherit', shell: true });
const backend = spawn('npm', ['run', 'scraper-service'], { stdio: 'inherit', shell: true });

process.on('SIGINT', () => {
  frontend.kill('SIGINT');
  backend.kill('SIGINT');
  process.exit();
});
