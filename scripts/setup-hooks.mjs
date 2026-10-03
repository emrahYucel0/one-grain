// npm "prepare": point git at the versioned hooks in .githooks/. Silent outside a git checkout
// (for example when the package is installed from a tarball).
import { execFileSync } from 'node:child_process';

try {
  execFileSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore' });
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' });
} catch {
  // not a git checkout, or git unavailable: nothing to set up
}
