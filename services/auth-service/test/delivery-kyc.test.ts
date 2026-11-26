import { describe, it, expect } from 'vitest';
import { isPartnerKycComplete } from '../src/models/delivery-partner.model.js';

describe('Auth Service: Delivery Partner KYC Completeness', () => {
  it('requires DL number, DL photo, RC photo, and ID proof for motorized vehicles', () => {
    expect(
      isPartnerKycComplete({
        vehicleType: 'bike',
        kycDocuments: {
          drivingLicenseNumber: 'KA0120200012345',
          drivingLicenseUrl: 'https://ik.imagekit.io/test/dl.jpg',
          vehicleRcUrl: 'https://ik.imagekit.io/test/rc.jpg',
          idProofUrl: 'https://ik.imagekit.io/test/id.jpg',
        },
      }),
    ).toBe(true);

    expect(
      isPartnerKycComplete({
        vehicleType: 'scooter',
        kycDocuments: {
          drivingLicenseNumber: 'KA0120200012345',
          drivingLicenseUrl: 'https://ik.imagekit.io/test/dl.jpg',
          idProofUrl: 'https://ik.imagekit.io/test/id.jpg',
        },
      }),
    ).toBe(false);
  });

  it('only requires Government ID proof for bicycles', () => {
    expect(
      isPartnerKycComplete({
        vehicleType: 'bicycle',
        kycDocuments: {
          idProofUrl: 'https://ik.imagekit.io/test/id.jpg',
        },
      }),
    ).toBe(true);

    expect(
      isPartnerKycComplete({
        vehicleType: 'bicycle',
        kycDocuments: {},
      }),
    ).toBe(false);
  });
});
