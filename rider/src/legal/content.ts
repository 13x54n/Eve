export type LegalSection = {
  heading: string;
  body: string;
};

export type LegalDocument = {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
};

export const LEGAL_OPERATOR = "Sherpa Foods";
export const LEGAL_PRODUCT = "Eve";
export const LEGAL_CONTACT_EMAIL = "support@sherpafoods.ca";
export const LEGAL_JURISDICTION = "Canada";

export const riderTerms: LegalDocument = {
  title: "Terms of Use",
  lastUpdated: "August 27, 2026",
  intro: `These Terms of Use ("Terms") govern your use of the ${LEGAL_PRODUCT} rider app and related services operated by ${LEGAL_OPERATOR} ("Eve", "we", "us"). By creating an account or requesting a ride, you agree to these Terms. This draft is provided for product and store-review purposes and should be reviewed by counsel before you rely on it.`,
  sections: [
    {
      heading: "1. The service",
      body: `${LEGAL_PRODUCT} is a marketplace that connects riders with independent drivers. We do not provide transportation as a carrier, taxi company, or employer of drivers. Drivers operate their own vehicles and are responsible for the ride they accept.`,
    },
    {
      heading: "2. Eligibility and account",
      body: "You must be at least 18 years old (or the age of majority in your province or territory) to create an account. You agree to provide accurate information, keep your login credentials confidential, and notify us if you believe your account has been misused. We may suspend or close accounts that violate these Terms or that we reasonably believe pose a safety or fraud risk.",
    },
    {
      heading: "3. Booking rides",
      body: "When you request a ride, you authorize us to match you with an available driver, share pickup and drop-off details, and estimate fare, distance, and time. Estimates are not guarantees. Availability, wait times, and routing depend on drivers, traffic, weather, and other conditions outside our control.",
    },
    {
      heading: "4. Fares and off-platform payment",
      body: "When you request a ride, the app shows a suggested fare. Drivers may send offers. If you accept an offer, Eve records the matched price for audit. Eve does not charge you in the app and does not take a commission. You pay the driver off-platform (for example in cash). Eve does not collect, guarantee, or refund that payment.",
    },
    {
      heading: "5. Cancellations and no-shows",
      body: "You may cancel a request in the app. Repeated cancellations, no-shows, or abuse of matching may result in account limits. Eve does not bill cancellation fees in-app.",
    },
    {
      heading: "6. Conduct and safety",
      body: "You agree to treat drivers and other users respectfully, follow applicable law, and not use the app for unlawful, harassing, or dangerous purposes. Do not interfere with the driver's ability to operate the vehicle safely. We may share limited trip information with the assigned driver and, where required, with law enforcement.",
    },
    {
      heading: "7. Ratings and feedback",
      body: "After a trip you may be asked to rate the driver. Ratings should be honest and not discriminatory. We may use ratings to improve matching and safety.",
    },
    {
      heading: "8. Intellectual property",
      body: `The ${LEGAL_PRODUCT} name, logo, app, and content are owned by ${LEGAL_OPERATOR} or its licensors. You receive a limited, non-exclusive, non-transferable license to use the rider app for personal, lawful ride booking. You may not copy, reverse engineer, or scrape the service except as allowed by law.`,
    },
    {
      heading: "9. Disclaimers",
      body: "The service is provided \"as is.\" We do not warrant uninterrupted availability, error-free matching, or that a particular driver or vehicle will meet your expectations. To the fullest extent permitted by law, we are not liable for acts or omissions of independent drivers, other riders, or third-party map or hosting providers.",
    },
    {
      heading: "10. Limitation of liability",
      body: `To the fullest extent permitted by the laws of ${LEGAL_JURISDICTION}, ${LEGAL_OPERATOR}'s aggregate liability arising out of these Terms or your use of the rider app is limited to CAD $100. Nothing in these Terms excludes liability that cannot be limited by law, including for fraud or death or personal injury caused by our negligence where such exclusion is prohibited.`,
    },
    {
      heading: "11. Changes and termination",
      body: "We may update these Terms. Continued use after an update constitutes acceptance of the revised Terms. You may stop using the app at any time. We may stop providing the service or close your account with reasonable notice where practicable, or immediately if we reasonably believe you have breached these Terms or created a safety risk.",
    },
    {
      heading: "12. Governing law",
      body: `These Terms are governed by the laws of ${LEGAL_JURISDICTION}, without regard to conflict-of-law rules. Courts in ${LEGAL_JURISDICTION} have exclusive jurisdiction, except that you may have additional rights as a consumer in your province or territory.`,
    },
    {
      heading: "13. Contact",
      body: `Questions about these Terms: ${LEGAL_CONTACT_EMAIL}.`,
    },
  ],
};

export const riderPrivacy: LegalDocument = {
  title: "Privacy Policy",
  lastUpdated: "August 27, 2026",
  intro: `${LEGAL_OPERATOR} ("Eve", "we", "us") operates the ${LEGAL_PRODUCT} rider app. This Privacy Policy explains how we collect, use, and share personal information when you use the rider app. It is drafted with Canada's Personal Information Protection and Electronic Documents Act (PIPEDA) and similar provincial rules in mind. Have counsel confirm it before store submission.`,
  sections: [
    {
      heading: "1. Information we collect",
      body: "Account: name, email, password (stored in hashed form), and optional phone number. Trips: pickup and drop-off addresses and coordinates, booking codes, suggested fare, matched fare, distance, duration, ratings, and support messages. Location: precise location when you use maps or request a ride, with your device permission. Device: app version and basic technical logs needed to operate the service. Marketing: whether you have opted in to marketing (consentMarketing). We do not collect payment-card details for rides.",
    },
    {
      heading: "2. How we use information",
      body: "We use this information to create and secure your account, match you with drivers, show maps and ETAs, calculate suggested fares, record matched prices for audit, prevent fraud, provide support, improve the product, and comply with law. Location is used to set pickup points, show nearby context, and complete the trip.",
    },
    {
      heading: "3. How we share information",
      body: "Assigned drivers receive the details needed to complete your trip (typically name or handle, pickup/drop-off, and contact as shown in the app). We use service providers for hosting, maps/geocoding, and file storage. We may disclose information if required by law, to protect rights and safety, or in connection with a business transaction. We do not sell your personal information.",
    },
    {
      heading: "4. Retention",
      body: "We keep account and trip records for as long as your account is active and for a reasonable period afterward for safety, tax, dispute, and legal purposes. You may request deletion; some records may be retained where we are required or permitted to keep them.",
    },
    {
      heading: "5. Your rights",
      body: `Subject to applicable law, you may request access to, correction of, or deletion of your personal information, or withdraw consent where processing is based on consent. You can also file a privacy request through support. Contact ${LEGAL_CONTACT_EMAIL}. We may need to verify your identity before fulfilling a request.`,
    },
    {
      heading: "6. Children",
      body: "The rider app is not directed to children under 13 (or the minimum age in your province). We do not knowingly collect personal information from children.",
    },
    {
      heading: "7. Security",
      body: "We use reasonable administrative and technical measures to protect information. No method of transmission or storage is completely secure.",
    },
    {
      heading: "8. International processing",
      body: "Your information may be processed on servers in or outside Canada, including by cloud and maps providers. Where required, we use contractual or other safeguards for cross-border transfers.",
    },
    {
      heading: "9. Changes",
      body: "We may update this policy. The \"Last updated\" date at the top will change. Material changes will be communicated in the app where practicable.",
    },
    {
      heading: "10. Contact",
      body: `Privacy questions: ${LEGAL_CONTACT_EMAIL}. ${LEGAL_OPERATOR}, ${LEGAL_JURISDICTION}.`,
    },
  ],
};
