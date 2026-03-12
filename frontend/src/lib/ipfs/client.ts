/**
 * IPFS client — uses Pinata API for pinning JSON to IPFS.
 * Falls back to localStorage-only mode if no Pinata JWT is configured.
 */

const PINATA_API_URL = 'https://api.pinata.cloud';
const PINATA_GATEWAY = import.meta.env.VITE_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs';

function getPinataJwt(): string | null {
  return import.meta.env.VITE_PINATA_JWT || null;
}

export function isIPFSConfigured(): boolean {
  return !!getPinataJwt();
}

export function getIPFSUrl(cid: string): string {
  return `${PINATA_GATEWAY}/${cid}`;
}

/**
 * Pin a JSON object to IPFS via Pinata.
 * Returns the IPFS CID (content identifier).
 */
export async function pinJSON(
  data: Record<string, unknown>,
  name?: string,
): Promise<string> {
  const jwt = getPinataJwt();
  if (!jwt) {
    throw new Error('IPFS not configured: set VITE_PINATA_JWT in .env');
  }

  const response = await fetch(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      pinataContent: data,
      pinataMetadata: {
        name: name || `obscura-proof-${Date.now()}`,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Pinata upload failed (${response.status}): ${errText.slice(0, 200)}`);
  }

  const result = await response.json();
  return result.IpfsHash as string;
}

/**
 * Fetch JSON from IPFS by CID.
 */
export async function fetchJSON<T = Record<string, unknown>>(cid: string): Promise<T> {
  const url = getIPFSUrl(cid);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`IPFS fetch failed (${response.status}): CID=${cid}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Unpin content from Pinata by CID.
 */
export async function unpin(cid: string): Promise<void> {
  const jwt = getPinataJwt();
  if (!jwt) return;

  await fetch(`${PINATA_API_URL}/pinning/unpin/${cid}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${jwt}` },
  });
}
