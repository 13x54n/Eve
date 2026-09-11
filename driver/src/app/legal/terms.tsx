import { LegalDocumentView } from "@/components/legal-document";
import { driverTerms } from "@/legal/content";

export default function DriverTermsScreen() {
  return <LegalDocumentView document={driverTerms} />;
}
