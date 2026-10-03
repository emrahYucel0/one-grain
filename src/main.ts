import './styles/main.css';
import { probeGpu } from './core/env';

const root = document.documentElement;
const gpu = probeGpu();

if (!gpu.webgl2) {
  root.classList.add('nogl');
} else {
  root.classList.add('gl');
}
