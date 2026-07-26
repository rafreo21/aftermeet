import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";

import { buildApplePassJson, walletIconBuffers } from "./apple-wallet-pass";
import type { AppleWalletCerts, WalletCardPayload } from "./wallet-config";

function sha1(content: Buffer | string) {
  return createHash("sha1").update(content).digest("hex");
}

function signManifest(manifestContent: string, certs: AppleWalletCerts) {
  const dir = mkdtempSync(join(tmpdir(), "aftermeet-pass-"));
  try {
    writeFileSync(join(dir, "manifest.json"), manifestContent);
    writeFileSync(join(dir, "wwdr.pem"), certs.wwdr);
    writeFileSync(join(dir, "signer.pem"), certs.signerCert);
    writeFileSync(join(dir, "key.pem"), certs.signerKey);
    const args = [
      "smime",
      "-binary",
      "-sign",
      "-certfile",
      join(dir, "wwdr.pem"),
      "-signer",
      join(dir, "signer.pem"),
      "-inkey",
      join(dir, "key.pem"),
      "-in",
      join(dir, "manifest.json"),
      "-out",
      join(dir, "signature"),
      "-outform",
      "DER",
      "-nodetach",
    ];
    if (certs.signerKeyPassphrase) {
      args.push("-passin", `pass:${certs.signerKeyPassphrase}`);
    }
    const result = spawnSync("openssl", args, { encoding: "buffer" });
    if (result.status !== 0) {
      throw new Error(result.stderr?.toString() || "Apple Wallet signing failed.");
    }
    return readFileSync(join(dir, "signature"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function buildAppleWalletPass(card: WalletCardPayload, certs: AppleWalletCerts) {
  const passJson = JSON.stringify(
    buildApplePassJson(card, { passTypeId: certs.passTypeId, teamId: certs.teamId }),
    null,
    2,
  );
  const files: Record<string, Buffer> = {
    "pass.json": Buffer.from(passJson, "utf8"),
    ...walletIconBuffers(),
  };
  const manifest = Object.fromEntries(
    Object.entries(files).map(([name, content]) => [name, sha1(content)]),
  );
  const manifestContent = JSON.stringify(manifest, null, 2);
  const signature = signManifest(manifestContent, certs);

  const zip = new JSZip();
  zip.file("pass.json", files["pass.json"]);
  zip.file("manifest.json", manifestContent);
  zip.file("signature", signature);
  for (const [name, content] of Object.entries(walletIconBuffers())) {
    zip.file(name, content);
  }

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
