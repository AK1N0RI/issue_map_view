import { createInterface } from 'node:readline';

export function promptLine(message) {
  if (!process.stdin.isTTY) {
    throw new Error('The live E2E suite requires an interactive terminal.');
  }
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    readline.question(message, (answer) => {
      readline.close();
      resolve(answer.trim());
    });
  });
}

export function promptSecret(message) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('The live E2E PAT prompt requires an interactive terminal.');
  }
  process.stdout.write(message);
  process.stdin.setEncoding('utf8');
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise((resolve, reject) => {
    let secret = '';
    const cleanup = () => {
      process.stdin.removeListener('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\u0003') {
          cleanup();
          process.stdout.write('\n');
          reject(new Error('PAT input cancelled'));
          return;
        }
        if (character === '\r' || character === '\n') {
          cleanup();
          process.stdout.write('\n');
          resolve(secret);
          return;
        }
        if (character === '\u007f' || character === '\b') {
          secret = secret.slice(0, -1);
        } else {
          secret += character;
        }
      }
    };
    process.stdin.on('data', onData);
  });
}
