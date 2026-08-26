import type { PkcePair } from './types';

const DEFAULT_VERIFIER_BYTE_LENGTH = 32;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generateCodeVerifier(length: number = DEFAULT_VERIFIER_BYTE_LENGTH): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  return toBase64Url(new Uint8Array(digest));
}

export async function generatePkcePair(length?: number): Promise<PkcePair> {
  const codeVerifier = generateCodeVerifier(length);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  return { codeVerifier, codeChallenge, codeChallengeMethod: 'S256' };
}
