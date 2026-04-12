import { Receiver } from "@upstash/qstash"

/**
 * Verifies that the incoming request came from a legitimate Upstash QStash trigger.
 * 
 * To use this, you must set these environment variables in your .env.local:
 * QSTASH_CURRENT_SIGNING_KEY
 * QSTASH_NEXT_SIGNING_KEY
 */
export async function verifyQStashSignature(req: Request): Promise<boolean> {
  const signature = req.headers.get("upstash-signature");
  if (!signature) return false;

  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
  });

  try {
    const rawBody = await req.text();
    const isValid = await receiver.verify({
      signature,
      body: rawBody,
    });
    return isValid;
  } catch (err) {
    console.error("[QSTASH VERIFICATION ERROR]", err);
    return false;
  }
}
