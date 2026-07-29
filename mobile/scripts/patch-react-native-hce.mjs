import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gradlePath = join(root, 'node_modules/react-native-hce/android/build.gradle');

if (!existsSync(gradlePath)) {
  process.exit(0);
}

const original = readFileSync(gradlePath, 'utf8');
const patched = original.replace(/\n\s*jcenter\(\)/g, '\n    mavenCentral()');

if (original === patched) {
  process.exit(0);
}

writeFileSync(gradlePath, patched);
console.log('[aftermeet] Patched react-native-hce/android/build.gradle (jcenter → mavenCentral).');
