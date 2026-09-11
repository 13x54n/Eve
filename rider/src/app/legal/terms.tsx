import { LegalDocumentView } from "@/components/legal-document";
import { riderTerms } from "@/legal/content";

export default function RiderTermsScreen() {
  return <LegalDocumentView document={riderTerms} />;
}
