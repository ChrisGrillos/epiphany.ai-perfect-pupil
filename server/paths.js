import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

export function dataDirectory() {
  return resolve(process.env.PUPIL_DATA_DIR || join(process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'PerfectPupil'));
}
