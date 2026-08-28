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
export const LEGAL_PRODUCT = "Eve Driver";
export const LEGAL_CONTACT_EMAIL = "support@sherpafoods.ca";
export const LEGAL_JURISDICTION = "Canada";

export const driverTerms: LegalDocument = {
  title: "Driver Terms of Use",
  lastUpdated: "August 27, 2026",
  intro: `These Driver Terms of Use ("Terms") govern your use of the ${LEGAL_PRODUCT} app and related services operated by ${LEGAL_OPERATOR} ("Eve", "we", "us"). By creating a driver account or going online, you agree to these Terms. This draft is for product and store-review purposes and should be reviewed by counsel before you rely on it.`,
  sections: [
    {
      heading: "1. Independent contractor",
      body: "You are an independent contractor, not an employee, partner, or agent of Eve. You decide when to go online, which offers to accept (subject to any quality or safety rules), and how to operate your vehicle. You are responsible for your own taxes, insurance, licenses, and expenses. Eve is a marketplace connecting you with riders; we do not provide transportation as a carrier.",
    },
    {
      heading: "2. Eligibility",
      body: "You must be legally authorized to drive, hold a valid driver's licence for the vehicle class you operate, meet local age and insurance requirements, and pass any document or background review we reasonably require. We may approve, pause, or reject driver accounts based on documents, vehicle condition, ratings, safety, or law.",
    },
    {
      heading: "3. Vehicle and documents",
      body: "You must keep licence, insurance, vehicle registration, and any other requested documents current and upload them when asked. Vehicles must be legal to operate, reasonably maintained, and match the details you registered (make, model, year, colour, plate, type). False or expired documents may result in immediate deactivation.",
    },
    {
      heading: "4. Offers, trips, and conduct",
      body: "When you are online we may send nearby ride requests. You may send one offer at a time. After you offer a price you wait while the rider chooses. You cannot offer on another trip until that offer is accepted, declined, or the request is cancelled. Accepting an offer is a commitment to pick up the rider promptly and complete the trip safely and professionally. You agree not to discriminate, harass, or endanger riders. You must follow traffic laws and not use the app in a way that distracts you while driving.",
    },
    {
      heading: "5. Offers, matched price, and payment",
      body: "Requests include a suggested fare. Your offer is recorded, and if the rider accepts, Eve stores the matched price for audit. Eve does not deduct commission, process ride payments, or pay you out. The rider pays you off-platform. You are responsible for collecting that payment and for tax reporting. Eve does not guarantee you will be paid.",
    },
    {
      heading: "6. Location while online",
      body: "To match you with nearby requests, the app collects precise location while you are using it and especially while you are online or on a trip. You must grant the location permissions the app requests. Turning location off while on a trip may prevent completion of the service and may violate these Terms.",
    },
    {
      heading: "7. Ratings, quality, and deactivation",
      body: "Riders may rate you. Low ratings, high cancellation rates, safety incidents, fraud, or document failures may lead to warnings, limits, or deactivation. We may investigate incidents reported in the app.",
    },
    {
      heading: "8. Intellectual property",
      body: `The ${LEGAL_PRODUCT} name, logo, app, and content are owned by ${LEGAL_OPERATOR} or its licensors. You receive a limited license to use the driver app solely to receive and complete marketplace trip offers. You may not misuse rider data obtained through the app.`,
    },
    {
      heading: "9. Disclaimers",
      body: "The service is provided \"as is.\" We do not guarantee a minimum number of offers, earnings, or uptime. Rider behaviour and road conditions are outside our control.",
    },
    {
      heading: "10. Limitation of liability",
      body: `To the fullest extent permitted by the laws of ${LEGAL_JURISDICTION}, ${LEGAL_OPERATOR}'s aggregate liability arising out of these Terms or your use of the driver app is limited to CAD $100. Nothing excludes liability that cannot be limited by law.`,
    },
    {
      heading: "11. Changes and termination",
      body: "We may update these Terms. Continued use after an update constitutes acceptance. You may stop driving and delete or close your account subject to outstanding trips. We may deactivate you immediately for safety, fraud, or material breach.",
    },
    {
      heading: "12. Governing law",
      body: `These Terms are governed by the laws of ${LEGAL_JURISDICTION}. Courts in ${LEGAL_JURISDICTION} have exclusive jurisdiction, except for non-waivable rights in your province or territory.`,
    },
    {
      heading: "13. Contact",
      body: `Questions about these Terms: ${LEGAL_CONTACT_EMAIL}.`,
    },
  ],
};

export const driverPrivacy: LegalDocument = {
  title: "Privacy Policy",
  lastUpdated: "August 27, 2026",
  intro: `${LEGAL_OPERATOR} ("Eve", "we", "us") operates the ${LEGAL_PRODUCT} app. This Privacy Policy explains how we collect, use, and share personal information when you use the driver app. It is drafted with PIPEDA and similar provincial rules in mind. Have counsel confirm it before store submission.`,
  sections: [
    {
      heading: "1. Information we collect",
      body: "Account: name, email, password (hashed), phone, city. Driver profile: approval status, ratings, acceptance and cancellation rates, online hours, recorded matched fares. Vehicle: make, model, year, colour, plate, type, capacity. Documents: images and files you upload (licence, insurance, and similar), stored with our file host (for example ImageKit), plus review status and expiry. Location: precise GPS while the app is in use, while you are online, and during trips, so we can send nearby offers and share progress. Trips: pickup/drop-off, suggested fare, offers you send, matched price. Device and logs needed to operate the app.",
    },
    {
      heading: "2. How we use information",
      body: "We use this information to verify you as a driver, match offers, show navigation context, record suggested and matched prices, review documents, improve safety and fraud prevention, provide support, and comply with law.",
    },
    {
      heading: "3. How we share information",
      body: "Riders on an assigned trip receive the details needed to identify you and the vehicle (typically first name or handle, vehicle description, plate as shown in the app, and live location during the trip). We use processors for hosting, maps, and file storage. We may disclose information if required by law, to protect safety, or in a business transaction. We do not sell your personal information.",
    },
    {
      heading: "4. Retention",
      body: "Driver, vehicle, document, and trip records are kept while your account is active and for a reasonable period afterward for safety, tax, insurance, and legal purposes. Document images may be retained for as long as needed to evidence compliance.",
    },
    {
      heading: "5. Your rights",
      body: `Subject to applicable law, you may request access, correction, or deletion of your personal information. Contact ${LEGAL_CONTACT_EMAIL}. We may retain information we are required or permitted to keep, including trip and safety records.`,
    },
    {
      heading: "6. Children",
      body: "The driver app is only for adults who are legally permitted to drive. We do not knowingly collect personal information from children.",
    },
    {
      heading: "7. Security",
      body: "We use reasonable measures to protect documents and account data. You must also protect your device and login. No transmission is completely secure.",
    },
    {
      heading: "8. International processing",
      body: "Information may be processed in or outside Canada by cloud, maps, and file-storage providers. We use contractual or other safeguards where required.",
    },
    {
      heading: "9. Changes",
      body: "We may update this policy. The \"Last updated\" date will change. Material changes will be communicated in the app where practicable.",
    },
    {
      heading: "10. Contact",
      body: `Privacy questions: ${LEGAL_CONTACT_EMAIL}. ${LEGAL_OPERATOR}, ${LEGAL_JURISDICTION}.`,
    },
  ],
};
