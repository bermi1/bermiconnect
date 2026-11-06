export interface ParsedReceipt {
  id: string;
  stat: string;
  err: string | null;
}

/** Parse SMPP DLR text: "id:XXXX sub:001 dlvrd:001 submit date:... done date:... stat:DELIVRD err:000 text:..." */
export function parseReceipt(text: string): ParsedReceipt | null {
  const id = /\bid:\s*([^\s]+)/i.exec(text)?.[1];
  const stat = /\bstat:\s*([A-Z]+)/i.exec(text)?.[1]?.toUpperCase();
  const err = /\berr:\s*([^\s]+)/i.exec(text)?.[1] ?? null;
  if (!id || !stat) return null;
  return { id, stat, err };
}
