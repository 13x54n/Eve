import type {
  DriverDocument,
  DriverDocumentType,
  DriverProfile,
  DriverVehicle,
} from '@/services/driver';

export const REQUIRED_DOCUMENT_TYPES: { type: DriverDocumentType; label: string }[] = [
  { type: 'IDENTITY', label: 'Identity' },
  { type: 'LICENSE', label: 'Driving license' },
  { type: 'INSURANCE', label: 'Insurance' },
  { type: 'VEHICLE_REGISTRATION', label: 'Vehicle registration' },
];

export type OnboardingHref = '/onboarding/vehicle' | '/onboarding/documents';

export type OnboardingStep = {
  id: string;
  label: string;
  complete: boolean;
  rejected: boolean;
  href?: OnboardingHref;
};

export type OnboardingProgress = {
  showCard: boolean;
  title: string;
  subtitle: string;
  blocked: boolean;
  driverStepsComplete: boolean;
  approved: boolean;
  steps: OnboardingStep[];
};

function isVehicleComplete(vehicles: DriverVehicle[] | undefined) {
  const vehicle = vehicles?.[0];
  return Boolean(vehicle?.make?.trim() && vehicle?.model?.trim() && vehicle?.plateNumber?.trim());
}

function isDocumentComplete(doc: DriverDocument | undefined) {
  if (!doc?.fileUrl) return false;
  return doc.status !== 'REJECTED' && doc.status !== 'EXPIRED';
}

export function getOnboardingProgress(profile: DriverProfile | null | undefined): OnboardingProgress {
  if (!profile) {
    return {
      showCard: false,
      title: '',
      subtitle: '',
      blocked: false,
      driverStepsComplete: false,
      approved: false,
      steps: [],
    };
  }

  const approved = profile.approvalStatus === 'APPROVED';
  const blocked =
    profile.approvalStatus === 'REJECTED' ||
    profile.approvalStatus === 'SUSPENDED' ||
    profile.approvalStatus === 'DEACTIVATED';

  const documentSteps: OnboardingStep[] = REQUIRED_DOCUMENT_TYPES.map(({ type, label }) => {
    const doc = profile.documents?.find((item) => item.type === type);
    const rejected = doc?.status === 'REJECTED' || doc?.status === 'EXPIRED';
    return {
      id: type,
      label,
      complete: isDocumentComplete(doc),
      rejected,
      href: '/onboarding/documents',
    };
  });

  const driverSteps: OnboardingStep[] = [
    {
      id: 'vehicle',
      label: 'Vehicle details',
      complete: isVehicleComplete(profile.vehicles),
      rejected: false,
      href: '/onboarding/vehicle',
    },
    ...documentSteps,
  ];

  const driverStepsComplete = driverSteps.every((step) => step.complete);
  const hasRejectedDocs = documentSteps.some((step) => step.rejected);

  const steps: OnboardingStep[] = [
    ...driverSteps,
    {
      id: 'review',
      label: 'Admin review',
      complete: approved,
      rejected: blocked,
    },
  ];

  const showCard = !approved || !driverStepsComplete || hasRejectedDocs;

  let title = 'Finish setup to go online';
  let subtitle = 'Complete the remaining steps before you can go online.';
  if (blocked) {
    title = 'Action required';
    subtitle = 'Your account cannot go online. Please contact support.';
  } else if (hasRejectedDocs) {
    title = 'Action required';
    subtitle = 'Some documents were rejected or expired. Re-upload them to continue.';
  } else if (driverStepsComplete) {
    title = 'Account under review';
    subtitle = 'Eve is reviewing your account. You can go online once approved.';
  }

  return {
    showCard,
    title,
    subtitle,
    blocked,
    driverStepsComplete,
    approved,
    steps,
  };
}
