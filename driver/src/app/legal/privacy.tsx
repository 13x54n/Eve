import { LegalDocumentView } from "@/components/legal-document";
import { driverPrivacy } from "@/legal/content";

export default function DriverPrivacyScreen() {
  return <LegalDocumentView document={driverPrivacy} />;
}
