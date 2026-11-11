import { defineConfig } from 'vite';

// base relativa: l'app gira da file locali dentro Capacitor.
export default defineConfig({ base: './', build: { target: 'es2020' } });
