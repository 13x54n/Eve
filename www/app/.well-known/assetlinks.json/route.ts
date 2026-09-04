import { NextResponse } from "next/server";

const fingerprint =
  process.env.ANDROID_CERT_SHA256 ?? "REPLACE_WITH_SHA256_CERT_FINGERPRINT";

export function GET() {
  return NextResponse.json(
    [
      {
        relation: [
          "delegate_permission/common.handle_all_urls",
          "delegate_permission/common.get_login_creds",
        ],
        target: {
          namespace: "android_app",
          package_name: "ca.sherpafoods.eve",
          sha256_cert_fingerprints: [fingerprint],
        },
      },
      {
        relation: [
          "delegate_permission/common.handle_all_urls",
          "delegate_permission/common.get_login_creds",
        ],
        target: {
          namespace: "android_app",
          package_name: "ca.sherpafoods.evedriver",
          sha256_cert_fingerprints: [fingerprint],
        },
      },
    ],
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}
